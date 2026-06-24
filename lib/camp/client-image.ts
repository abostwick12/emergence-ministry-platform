export type CampImageUploadKind = "camperProfile" | "medicationLabel";

export type CampImageUploadProfile = {
  maxDimension: number;
  maxPassthroughBytes: number;
  quality: number;
  outputType: "image/jpeg";
};

export const campImageUploadProfiles: Record<CampImageUploadKind, CampImageUploadProfile> = {
  camperProfile: {
    maxDimension: 1600,
    maxPassthroughBytes: 1_200_000,
    quality: 0.82,
    outputType: "image/jpeg"
  },
  medicationLabel: {
    maxDimension: 2400,
    maxPassthroughBytes: 2_200_000,
    quality: 0.9,
    outputType: "image/jpeg"
  }
};

export function shouldPrepareCampImage(file: Pick<File, "size" | "type">, profile: CampImageUploadProfile): boolean {
  return file.size > profile.maxPassthroughBytes || file.type.toLowerCase().startsWith("image/heic") || file.type.toLowerCase().startsWith("image/heif");
}

export async function prepareCampImageFile(file: File, kind: CampImageUploadKind): Promise<File> {
  const profile = campImageUploadProfiles[kind];
  if (!shouldPrepareCampImage(file, profile)) return file;

  try {
    const image = await loadImage(file);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (!largestSide || (largestSide <= profile.maxDimension && file.size <= profile.maxPassthroughBytes)) return file;

    const scale = Math.min(1, profile.maxDimension / largestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, profile.outputType, profile.quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: profile.outputType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
