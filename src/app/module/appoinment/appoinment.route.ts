// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>

import { auth } from "../../middleware/checkAuth";
import { Router } from "express";
import { AppoimentController } from "./appoinemnt.controller";
import { Role } from "../../../generated/prisma/enums";


const router = Router();

router.post('/book-appointment',auth(Role.PATIENT, Role.ADMIN, Role.DOCTOR, Role.SUPER_ADMIN), AppoimentController.bookAppoiment)
router.post('/pay-appointment', AppoimentController.payAppoiment)
router.get('/book-appoinment/payment/callback',   AppoimentController.bookAppoimentCallBack)
router.get('/cancel-ammount')

export const AppoinmentRoutes = router;