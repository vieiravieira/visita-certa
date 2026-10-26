/**
 * Reduz a foto antes de enviar (lado maior 1280 px, JPEG ~70%).
 * Uma foto de 4 MB vira ~150–250 KB — essencial no plano grátis do Supabase.
 */
export async function comprimirFoto(arquivo: File, ladoMax = 1280, qualidade = 0.7): Promise<Blob> {
  const bitmap = await carregar(arquivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir a foto."))),
      "image/jpeg",
      qualidade,
    ),
  );
}

async function carregar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // respeita a rotação da câmera (EXIF)
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      /* cai no método antigo abaixo */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
    img.src = URL.createObjectURL(arquivo);
  });
}
