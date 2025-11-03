import { Router } from 'express';
import { signup, login, me } from '../controllers/caregiverController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth('caregiver'), me);

export default router;
