# Storage Foundation API Async Wrapper

This repo contains a JS wrapper (nativeio_async_wrapper.js) for Storage
Foundation API. The wrapper uses Asyncify to expose synchronous functions out of
asynchronous Storage Foundation API functions.

Also included is a C++ example (wrapped.cpp) that shows how to import and use
the wrapper.

Note: Storage Foundation API used to be called NativeIO. Some references to this
name still remain, they will be removed after the new name has landed on Chrome.

## How To

To compile the example run:

```shell
emcc --js-library ./nativeio_async_wrapper.js \
    -s ASYNCIFY -s USE_PTHREADS=1 \
    -s 'ASYNCIFY_IMPORTS=["NativeIO_Open", "NativeIO_Delete", "NativeIO_GetAll", "NativeIO_Read", "NativeIO_Write", "NativeIO_Close"]' \
    -o wrapped.html wrapped.cpp
```

> NOTE: USE_PTHREADS=1 is used to ensure that the Wasm module is instantiated
> with a SharedArrayMemory as the backing structure of the memory. This is
> required (for now) by the read/write calls.

To see the result run:

```shell
emrun --serve_after_exit --no_browser wrapped.html
```

And then open the following link in a Chrome instance with the
"Experimental Web Platform features" flag enabled:
[localhost:6931/wrapped.html](http://localhost:6931/wrapped.html)
