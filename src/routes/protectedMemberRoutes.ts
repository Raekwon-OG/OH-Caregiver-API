import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as controller from '../controllers/protectedMemberController';

const router = Router();

router.use(requireAuth('caregiver'));

router.post('/', controller.createMember);
router.get('/', controller.listMembers);
router.get('/:id', controller.getMember);
router.put('/:id', controller.updateMember);
router.delete('/:id', controller.deleteMember);

export default router;
