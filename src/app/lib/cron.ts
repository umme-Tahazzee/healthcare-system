import cron from "node-cron";
import { DoctorVerificationStatus, Role } from "../../generated/prisma/enums";
import { prisma } from "./prisma";

export const deleteUnverifiedDoctor = async () => {
	cron.schedule("*/10 * * * * ", async () => {
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
			const deleteDoctors = await prisma.user.deleteMany({
				where: {
					role: Role.DOCTOR,
					emailVerified: false,
					createdAt: { lt: oneHourAgo },
					doctor: { verificationStatus: DoctorVerificationStatus.PENDING },
				},
			});

            // console.log(deleteDoctors, 'show doctors deleted');
            

			if (deleteDoctors.count > 0) {
				console.log(`
                 Cron: Deleted ${deleteDoctors.count} unverified email doctor application older than 1 hour
                `);
			}
		} catch (error) {
            console.log(`Cron Failed to delete unverified doctor application `, error);
            
        }
        console.log("Doctor Deleted cron schedule (every 2 minutes) ");
        
	});
};