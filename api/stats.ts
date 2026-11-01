import { db } from '../server/db.js';
export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({
    totalMaterials: db.getMaterials().length,
    publishedMaterials: db.getMaterials('published').length,
    totalQuestions: db.getQuestions().length,
    totalQuizzes: db.getQuizzes().length,
    totalChunks: db.getChunks().length
  });
}
