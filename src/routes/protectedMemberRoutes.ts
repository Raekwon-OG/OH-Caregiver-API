import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as controller from '../controllers/protectedMemberController';
import { validateBody } from '../middleware/validate';
import { ProtectedMemberCreateSchema, ProtectedMemberUpdateSchema } from '../schemas/protectedMember';

const router = Router();

router.use(requireAuth('caregiver'));

router.post('/', validateBody(ProtectedMemberCreateSchema), controller.createMember);
router.get('/', controller.listMembers);
router.get('/:id', controller.getMember);
router.put('/:id', validateBody(ProtectedMemberUpdateSchema), controller.updateMember);
router.delete('/:id', controller.deleteMember);

export default router;
