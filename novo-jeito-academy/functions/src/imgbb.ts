/**
 * Upload de imagens — ImgBB
 * Reaproveita a mesma conta/API Key já usada no sistema da barbearia.
 *
 * Secret necessário:
 *   firebase functions:secrets:set IMGBB_API_KEY
 *
 * Uso típico: upload de foto de capa, fotos da galeria, foto do instrutor
 * feito pelo painel admin (não confundir com vídeo das aulas, que fica no Cloudflare Stream).
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const IMGBB_API_KEY = defineSecret("IMGBB_API_KEY");

export const uploadImage = onRequest(
  { cors: true, secrets: [IMGBB_API_KEY] },
  async (req, res) => {
    try {
      const { imageBase64, name } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "imageBase64 obrigatório" });
        return;
      }

      // imageBase64 pode vir como data URL ("data:image/png;base64,...") — a API do ImgBB aceita só o base64 puro
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;

      const form = new URLSearchParams();
      form.append("key", IMGBB_API_KEY.value());
      form.append("image", base64Data);
      if (name) form.append("name", name);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: form,
      });
      const json = await response.json();

      if (!json.success) {
        res.status(502).json({ error: "Falha no upload ao ImgBB", detail: json });
        return;
      }

      // json.data.url = link direto da imagem, pronto pra salvar no Firestore e usar no <img src="">
      res.status(200).json({
        url: json.data.url,
        thumbUrl: json.data.thumb?.url || json.data.url,
        deleteUrl: json.data.delete_url,
      });
    } catch (err) {
      console.error("uploadImage error:", err);
      res.status(500).json({ error: "Erro interno no upload" });
    }
  }
);
