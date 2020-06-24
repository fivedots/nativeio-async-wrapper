#include <string>

#include <emscripten.h>

extern "C" {
  // Filesystem-like calls
  extern int NativeIO_Open(const char* name);
  extern int NativeIO_Delete(const char* name);
  extern char** NativeIO_GetAll(int* resultLength);

  //File handle calls
  extern int NativeIO_Read(int fileDescriptor, void* buffer, int bufferLength, unsigned long long int offset);
  extern int NativeIO_Write(int fileDescriptor, void* buffer, int bufferLength, unsigned long long int offset);
  extern int NativeIO_Close(int fileDescriptor);
}

int main() {
  auto f = NativeIO_Open("test_file");
  EM_ASM({console.log("Open returned file descriptor number", $0 )}, f);

  auto write_buffer = new uint8_t[10];
  for(int i = 0; i < 10; i++) {
    write_buffer[i] = 1;
  }

  EM_ASM({console.log("Writing 10 bytes (value 1) at offset 4")});
  auto ret = NativeIO_Write(f, write_buffer, 10, 4);
  EM_ASM({console.log($0 + " bytes were written")}, ret);

  auto read_buffer = new uint8_t[6];
  EM_ASM({console.log("Reading 6 bytes at offset 0")});
  ret = NativeIO_Read(f, read_buffer, 6, 0);
  EM_ASM({console.log($0 + " bytes were read. Contents:")}, ret);
  for(int i = 0; i < 6; i++) {
    EM_ASM({console.log("\t", $0)}, read_buffer[i]);
  }

  ret = NativeIO_Close(f);
  EM_ASM({console.log("Close returned", $0 )}, ret);

  int resultLength;
  auto names = NativeIO_GetAll(&resultLength);
  EM_ASM({console.log("GetAll returned (length:",  $0+"):" )}, resultLength);
  for(int i = 0; i < resultLength; i++) {
    std::string name(names[i]);
    EM_ASM({console.log("\t", UTF8ToString($0))}, name.c_str());
    free(names[i]);
  }
  free(names);

  ret = NativeIO_Delete("test_file");
  EM_ASM({console.log("Delete returned", $0 )}, ret);

  return 0;
}
