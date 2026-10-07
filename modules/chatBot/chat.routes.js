import express from 'express';
import { smartAskWithRAG } from './rag.service.js';
import logger from '../../utils/logger.js';


const router = express.Router();

router.post('/', async (req, res) =>
{
    const { question } = req.body || {};

    if (typeof question !== 'string' || question.trim().length < 1 || question.length > 500)
    {
        return res.status(400).json({ success: false, message: 'السؤال مطلوب ويجب ألا يزيد عن 500 حرف' });
    }

    try
    {
        const answer = await smartAskWithRAG(question.trim());
        res.json({ answer });
    }
    catch (err)
    {
        logger.error(`Chatbot failed: ${err.message}`);
        res.status(503).json({ success: false, message: 'المساعد الذكي غير متاح حالياً، حاول مرة أخرى لاحقاً' });
    }
});

export default router;
