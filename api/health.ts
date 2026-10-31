import app from '../server';

export default async function handler(req: any, res: any) {
  return app(req, res);
}
