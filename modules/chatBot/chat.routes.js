import express from 'express';
import { smartAskWithRAG } from './rag.service.js';


const router = express.Router();

router.post('/', async (req, res) => {
    const { question } = req.body;

    try {
        const answer = await smartAskWithRAG(question);
        res.json({ answer });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء معالجة السؤال' });
    }
});

export default router;
