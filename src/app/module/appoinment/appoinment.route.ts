// auth.route.ts
// biome-ignore assist/source/organizeImports: <explanation>

import { Router } from "express";
import { AppoimentController } from "./appoinemnt.controller";


const router = Router();

router.post('/book-appointment', AppoimentController.bookAppoiment)

//book appoinment callback url
router.get('/book-appoinment/payment/callback', AppoimentController.bookAppoiment)


export const AppoinmentRoutes = router;