// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>

import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AppoimentController } from "./appoinemnt.controller";


const router = Router();

router.post('/book-appointment',auth(Role.PATIENT), AppoimentController.bookAppoiment)
router.post('/pay-appointment',auth(Role.PATIENT), AppoimentController.payAppoiment)
router.post('/cancel-appointment', AppoimentController.cancelAppoinment)

//callback 
router.get('/book-appoinment/payment/callback',   AppoimentController.bookAppoimentCallBack)
export const AppoinmentRoutes = router;