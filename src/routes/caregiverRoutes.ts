import { Router } from 'express';
import { signup, login, me } from '../controllers/caregiverController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { CaregiverSignupSchema, CaregiverLoginSchema } from '../schemas/caregiver';
import { signupLimiter, loginLimiter } from '../middleware/rateLimiters';

const router = Router();

router.post('/signup', signupLimiter, validateBody(CaregiverSignupSchema), signup);
router.post('/login', loginLimiter, validateBody(CaregiverLoginSchema), login);
router.get('/me', requireAuth('caregiver'), me);

export default router;
