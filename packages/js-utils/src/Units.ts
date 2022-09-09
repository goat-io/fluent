class UnitsClass {
  gigaBytes(bytes: number): number {
    return Math.round(bytes / 1024 ** 3)
  }

  megaBytes(bytes: number): number {
    return Math.round(bytes / 1024 ** 2)
  }

  kiloBytes(bytes: number): number {
    return Math.round(bytes / 1024)
  }

  humanByteSize(bytes = 0): string {
    if (bytes < 1024) return `${Math.round(bytes)} byte`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toPrecision(3)} Kb`
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toPrecision(3)} Mb`
    if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toPrecision(3)} Gb`
    if (bytes < 1024 ** 5) return `${(bytes / 1024 ** 4).toPrecision(3)} Tb`
    return `${Math.round(bytes / 1024 ** 4)} Tb`
  }
}

export const Units = new UnitsClass()
