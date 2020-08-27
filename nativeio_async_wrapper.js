mergeInto(LibraryManager.library, {
  $NativeIOWrapper: {
    // Holds the last file descriptor used, which increases monotonically on
    // each open.
    lastFileDescriptor: 100,

    // Associates a file descriptor (a number) with a FileHandle. This file
    // handle is the object obtained from calling NativeIO.open.
    fileDescriptorToFileHandle: {},

    // Opens a NativeIO file and returns a (promise-wrapped) file descriptor
    // that acts as an ID for the FileHandle.
    open: function(name) {
      return nativeIO.open(name).then((fileHandle) => {
        var fd = ++NativeIOWrapper.lastFileDescriptor;
        NativeIOWrapper.fileDescriptorToFileHandle[fd] = fileHandle;
        return fd;
      });
    },

    // Deletes a NativeIO file, removing it's name from the fileset. The file
    // cannot be open.
    delete: function(name) {
      return nativeIO.delete(name);
    },

    // Returns a (promise-wrapped) list with all the names currently in the
    // fileset
    getAll: function() {
      return nativeIO.getAll();
    },

    // Fills the provided buffer (which must be a SharedArrayBuffer) by reading
    // the fd at the specified offset. Returns the (promise-wrapped) number of
    // read bytes.
    read: function(fd, buffer, offset) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].read(buffer,
                                                                   offset);
    },

    // Writes the provided buffer (which must be a SharedArrayBuffer) to the fd
    // at the specified offset. Returns the (promise-wrapped) number of written
    // bytes.
    write: function(fd, buffer, offset) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].write(buffer,
                                                                   offset);
    },

    // Sets the size of fd to length bytes. If the new length is smaller than
    // the current one, bytes are removed starting from the end of the file.
    // Otherwise the file is extended with zero-valued bytes.
    setLength: function(fd, length) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].setLength(length);
    },

    // Returns the length of fd in bytes.
    getLength: function(fd) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].getLength();
    },

    // Flushes changes on the fd to the disk.
    flush: function(fd) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].flush();
    },

    // Closes the NativeIO file associated with the file descriptor.
    close: function(fd) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].close().then(() => {
        delete NativeIOWrapper.fileDescriptorToFileHandle[fd];
      });
    },
  },

  $NativeIOUtils: {
    // Utility function that combines two 32 bit integers that represent the
    // high and low bytes of a 64 bit integer into a full range JS number. The
    // function throws if the resulting combination would be out of range (i.e.
    // when the result is >= 2^53 or <= -2^53). This is useful when relying on
    // the defineI64Param Emscripten macro to receive 64 bit integer parameters
    // from ported applications.
    combineI64Params: function(param_low, param_high) {
      var HIGH_OFFSET = 0x100000000; // 2^32
      // use an unsigned operator on low and shift high by 32-bits
      var param = param_high * HIGH_OFFSET + (param_low >>> 0);

      var DOUBLE_LIMIT = 0x20000000000000; // 2^53
      // we also check for equality since DOUBLE_LIMIT + 1 == DOUBLE_LIMIT
      if (param <= -DOUBLE_LIMIT || param >= DOUBLE_LIMIT) {
        throw 'parameter is out of valid range';
      }
      return param;
    },
  },

  NativeIO_Open__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Open: function(name_ptr) {
    var name = UTF8ToString(name_ptr);
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.open(name).then(
        (fd) => {wakeUp(fd)},
        (error) => {
          console.log(`NativeIO error while opening "${name}":`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Delete__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Delete: function(name_ptr) {
    var name = UTF8ToString(name_ptr);
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.delete(name).then(
        () => {wakeUp(0)},
        (error) => {
          console.log(`NativeIO error while deleting "${name}":`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  // Returns a char** with the names of the files currently stored.
  // The value pointed by resultLength_ptr is overwritten with the number
  // of names.
  NativeIO_GetAll__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_GetAll: function(resultLength_ptr) {
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.getAll().then(
        (names) => {
          var name_ptrs = [];
          names.forEach(name => {
            var length = lengthBytesUTF8(name);
            var ptr = Module._malloc(length + 1);
            name_ptrs.push(ptr);

            stringToUTF8(name, ptr, length + 1);
          })

          var resultLength = name_ptrs.length;
          setValue(resultLength_ptr, resultLength, 'i32')

          var resultSize = name_ptrs.length*4;
          var result_ptr = Module._malloc(resultSize);
          for(var i = 0; i < resultLength; i++) {
            setValue(result_ptr + (i*4), name_ptrs[i], 'i32');
          }
          wakeUp(result_ptr);
        },

        (error) => {
          console.log('NativeIO error executing getAll:', error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Read__deps: ['$NativeIOWrapper', '$NativeIOUtils', '$Asyncify'],
  NativeIO_Read: function(fileDescriptor, buffer_ptr, length, {{{ defineI64Param('offset') }}}) {
    return Asyncify.handleSleep(function(wakeUp) {
      {{{ receiveI64ParamAsI32s('offset') }}}
      try {
        var offset = NativeIOUtils.combineI64Params(offset_low, offset_high);
      } catch (error) {
        console.log(
          `NativeIO error receiving offset to read from file with file descriptor number ${fileDescriptor}:`, error);
        wakeUp(-{{{cDefine('EINVAL')}}})
      }

      var buffer = Module.HEAP8.subarray(buffer_ptr, buffer_ptr + length);
      NativeIOWrapper.read(fileDescriptor, buffer, offset).then(
        (bytes_read) => {wakeUp(bytes_read)},
        (error) => {
          console.log(
            `NativeIO error reading from file with file descriptor number ${fileDescriptor} at offset ${offset}:`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Write__deps: ['$NativeIOWrapper','$NativeIOUtils', '$Asyncify'],
  NativeIO_Write: function(fileDescriptor, buffer_ptr, length, {{{ defineI64Param('offset') }}}) {
    return Asyncify.handleSleep(function(wakeUp) {
      {{{ receiveI64ParamAsI32s('offset') }}}
      try {
        var offset = NativeIOUtils.combineI64Params(offset_low, offset_high);
      } catch (error) {
        console.log(
          `NativeIO error receiving offset to write to file with file descriptor number ${fileDescriptor}:`, error);
        wakeUp(-{{{cDefine('EINVAL')}}})
      }

      var buffer = Module.HEAP8.subarray(buffer_ptr, buffer_ptr + length);
      NativeIOWrapper.write(fileDescriptor, buffer, offset).then(
        (bytes_written) => {wakeUp(bytes_written)},
        (error) => {
          console.log(
            `NativeIO error writing to file with file descriptor number ${fileDescriptor} at offset ${offset}:`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_SetLength__deps: ['$NativeIOWrapper','$NativeIOUtils', '$Asyncify'],
  NativeIO_SetLength: function(fileDescriptor, {{{ defineI64Param('length') }}}) {
    return Asyncify.handleSleep(function(wakeUp) {
      {{{ receiveI64ParamAsI32s('length') }}}
      try {
        var length = NativeIOUtils.combineI64Params(length_low, length_high);
      } catch (error) {
        console.log(
          `NativeIO error receiving length to truncate file with file descriptor number ${fileDescriptor}:`, error);
        wakeUp(-{{{cDefine('EINVAL')}}});
      }

      NativeIOWrapper.setLength(fileDescriptor, length).then(
        () => {wakeUp(0)},
        (error) => {
          console.log(
            `NativeIO error while setting length of file with file descriptor number ${fileDescriptor} to ${length}:`, error);
          wakeUp(-{{{cDefine('EINVAL')}}});
        })
    })
  },

  NativeIO_GetLength__deps: ['$NativeIOWrapper','$NativeIOUtils', '$Asyncify'],
  NativeIO_GetLength: function(fileDescriptor) {
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.getLength(fileDescriptor).then(
        (length) => {wakeUp(length)},
        (error) => {
          console.log(
            `NativeIO error while getting length of file with file descriptor number ${fileDescriptor} :`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Flush__deps: ['$NativeIOWrapper','$NativeIOUtils', '$Asyncify'],
  NativeIO_Flush: function(fileDescriptor) {
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.flush(fileDescriptor).then(
        () => {wakeUp(0)},
        (error) => {
          console.log(
            `NativeIO error while flushing file with file descriptor number ${fileDescriptor} :`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Close__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Close: function(fileDescriptor) {
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.close(fileDescriptor).then(
        () => {wakeUp(0)},
        (error) => {
          console.log(`NativeIO error closing file with file descriptor number ${fileDescriptor}:`, error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },
});
