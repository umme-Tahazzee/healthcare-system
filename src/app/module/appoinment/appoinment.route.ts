// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>

import { Router } from "express";
import { AppoimentController } from "./appoinemnt.controller";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";


const router = Router();

router.post('/book-appointment',auth(Role.PATIENT, Role.ADMIN, Role.DOCTOR, Role.SUPER_ADMIN), AppoimentController.bookAppoiment)

//book appoinment callback url
router.get('/book-appoinment/payment/callback',   AppoimentController.bookAppoimentCallBack)


export const AppoinmentRoutes = router;