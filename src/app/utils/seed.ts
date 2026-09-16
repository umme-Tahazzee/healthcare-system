// biome-ignore assist/source/organizeImports: <explanation>
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const seedSuperAdmin = async () => {
	try {
		const isSupperAdmin = await prisma.user.findFirst({
			where: {
				role: Role.SUPER_ADMIN,
			},
		});

		if (isSupperAdmin) {
			console.log("super admin already exits");
            return;
		}

       
		const name = config.super_admin_name 
		const email = config.super_admin_email 
		const password = config.super_admin_password

         if(!name || !password || !email) {
             throw new Error("Super Admin name, email password missing...")
        }
        
		const hashPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);
		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashPassword,
				role: Role.SUPER_ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});
        console.log(superAdmin);
        
	} catch (error) {
         console.log("error seeding super admin :", error);
         await prisma.user.delete({
            where : {
                  email : config.super_admin_email
            }
         })
    }
};



export const seedTeasterAdmin = async () => {
	try {
		const isSeedTeasterAdmin = await prisma.user.findUnique({
			where: {
				email : config.tester_admin_email
			},
		});

		if (isSeedTeasterAdmin) {
			console.log("Tester admin already exits");
            return;
		}

       
		const name = config.tester_admin_name
		const email = config.tester_admin_email 
		const password = config.tester_admin_password

         if(!name || !password || !email) {
             throw new Error("Tester Admin name, email password missing...")
        }
        
		const hashPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);
		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});
        console.log(testerAdmin);
        
	} catch (error) {
         console.log("error seeding testing admin :", error);
         await prisma.user.delete({
            where : {
                  email : config.tester_admin_email
            }
         })
    }
};


export const seedTeasterDoctor = async () => {
	try {
		const isSeedTeasterDoctor = await prisma.user.findUnique({
			where: {
				email : config.tester_doctor_email
			},
		});

		if (isSeedTeasterDoctor) {
			console.log("Tester admin already exits");
            return;
		}

       
		const name = config.tester_doctor_name
		const email = config.tester_doctor_email 
		const password = config.tester_doctor_password

         if(!name || !password || !email) {
             throw new Error("Doctor  name, email password missing...")
        }
        
		const hashPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);
		const doctorAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashPassword,
				role: Role.DOCTOR,
				needPasswordChange: false,
				emailVerified: true,
				doctor: {
					 create:{
						 email,
						 name, 
                         experienceYear : 5,
						 qualifications : 'MBBS',
						 licenseNumber : 'BMDC0000',
						 specialization : "Neurology"

					 }
				}
			},
		});
        console.log(doctorAdmin);
        
	} catch (error) {
         console.log("error seeding testing admin :", error);
         await prisma.user.delete({
            where : {
                  email : config.tester_doctor_email
            }
         })
    }
};