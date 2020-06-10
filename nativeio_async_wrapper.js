mergeInto(LibraryManager.library, {
  $NativeIOWrapper: {
    // Holds the last file descriptor used, which increases monotonically on
    // each open.
    lastFileDescriptor: 100,

    // Associates a fileDescriptor (a number) with a FileHandle. This file
    // handle is the object obtained from calling NativeIO.open and may be
    // expanded with new fields (e.g. seek_position).
    fileDescriptorToFileHandle: {},

    // Opens a NativeIO file and returns a (promise-wrapped) number that acts
    // as an ID for the FileHandle.
    open: function(name) {
      return nativeIO.open(name).then((fileHandle) => {
        var fd = ++NativeIOWrapper.lastFileDescriptor;
        NativeIOWrapper.fileDescriptorToFileHandle[fd] = fileHandle;
        return fd;
      });
    },

    // Deletes a NativeIO file, removing it's name from the fileset. All
    // existing file handles must be closed before calling delete.
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

    // Closes the NativeIO file associated with the fd file descriptor.
    close: function(fd) {
      return NativeIOWrapper.fileDescriptorToFileHandle[fd].close().then(() => {
        delete NativeIOWrapper.fileDescriptorToFileHandle[fd];
      });
    },
  },

  NativeIO_Open__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Open: function(name_ptr) {
    var name = UTF8ToString(name_ptr);
    return Asyncify.handleSleep(function(wakeUp) {
      NativeIOWrapper.open(name).then(
        (fd) => {wakeUp(fd)},
        (error) => {
          console.log('NativeIO error while opening \"', name, '\": ', error);
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
          console.log('NativeIO error while deleting \"', name, '\": ', error);
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

  NativeIO_Read__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Read: function(fileDescriptor, buffer_ptr, length, offset) {
    //TODO get buffer off heap
    return Asyncify.handleSleep(function(wakeUp) {
      var buffer = Module.HEAP8.subarray(buffer_ptr, buffer_ptr + length);
      NativeIOWrapper.read(fileDescriptor, buffer, offset).then(
        (bytes_read) => {wakeUp(bytes_read)},
        (error) => {
          console.log(
            'NativeIO error reading from file with file descriptor number',
            fileDescriptor + ', at offset', offset + ':', error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },

  NativeIO_Write__deps: ['$NativeIOWrapper', '$Asyncify'],
  NativeIO_Write: function(fileDescriptor, buffer_ptr, length, offset) {
    //TODO
    return Asyncify.handleSleep(function(wakeUp) {
      var buffer = Module.HEAP8.subarray(buffer_ptr, buffer_ptr + length);
      NativeIOWrapper.write(fileDescriptor, buffer, offset).then(
        (bytes_written) => {wakeUp(bytes_written)},
        (error) => {
          console.log(
            'NativeIO error writing to file with file descriptor number',
            fileDescriptor + ', at offset', offset + ':', error);
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
          console.log('NativeIO error closing file with file descriptor number', fileDescriptor, ': ', error);
          wakeUp(-{{{cDefine('EINVAL')}}})
        })
    })
  },
});
