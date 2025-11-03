import { Router } from 'express';
import { signup, login, me } from '../controllers/caregiverController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { CaregiverSignupSchema, CaregiverLoginSchema } from '../schemas/caregiver';

const router = Router();

router.post('/signup', validateBody(CaregiverSignupSchema), signup);
router.post('/login', validateBody(CaregiverLoginSchema), login);
router.get('/me', requireAuth('caregiver'), me);

export default router;
