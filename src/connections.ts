
export interface Filesystem {
  writeFile(filepath: string, contents: string): void
  exists(filepath: string): boolean  
  ensureSymlink(destination: string, source: string): boolean
}
