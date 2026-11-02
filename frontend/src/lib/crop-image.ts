export type CropArea = { x: number; y: number; width: number; height: number };

/** Export a square crop as a metadata-free JPEG suitable for avatar uploads. */
export async function cropImageToJpeg(imageUrl: string, area: CropArea): Promise<Blob> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error();

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error())),
      "image/jpeg",
      0.9,
    );
  });
}
