require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/student');

const FIRST_NAMES = [
    'Andrea',
    'Angela',
    'Bea',
    'Bianca',
    'Carla',
    'Christine',
    'Daniela',
    'Diana',
    'Ella',
    'Faith',
    'Gabrielle',
    'Hannah',
    'Isabel',
    'Jasmine',
    'Joanna',
    'Julia',
    'Katrina',
    'Kimberly',
    'Kristine',
    'Leah',
    'Maria',
    'Nicole',
    'Patricia',
    'Rachel',
    'Samantha',
    'Sophia',
    'Trisha',
    'Vanessa',
    'Adrian',
    'Aldrin',
    'Angelo',
    'Carlo',
    'Christian',
    'Daniel',
    'David',
    'Enzo',
    'Francis',
    'Gabriel',
    'Ian',
    'James',
    'Jerome',
    'John',
    'Joshua',
    'Justin',
    'Kenneth',
    'Kevin',
    'Kyle',
    'Lance',
    'Mark',
    'Matthew',
    'Nathan',
    'Paolo',
    'Rafael',
    'Ryan',
    'Sean',
    'Vincent',
];

const MIDDLE_NAMES = [
    'Rivera',
    'Santos',
    'Reyes',
    'Garcia',
    'Cruz',
    'Flores',
    'Ramos',
    'Mendoza',
    'Castillo',
    'Torres',
    'Navarro',
    'Aquino',
    'Villanueva',
    'Diaz',
    'Lopez',
    '',
];

const LAST_NAMES = [
    'Abad',
    'Aguilar',
    'Aquino',
    'Bautista',
    'Castillo',
    'Castro',
    'Cruz',
    'Dela Cruz',
    'Diaz',
    'Domingo',
    'Flores',
    'Garcia',
    'Gonzales',
    'Lim',
    'Lopez',
    'Mendoza',
    'Navarro',
    'Pascual',
    'Ramos',
    'Reyes',
    'Rivera',
    'Santos',
    'Soriano',
    'Torres',
    'Valdez',
    'Villanueva',
];

const COLLEGE_PROGRAMS = [
    {
        college: 'College of Computer Studies',
        programs: [
            'BS Information Technology',
            'BS Computer Science',
            'BS Computer Applications',
        ],
    },
    {
        college: 'College of Engineering',
        programs: [
            'BS Civil Engineering',
            'BS Electrical Engineering',
            'BS Mechanical Engineering',
            'BS Electronics Engineering',
        ],
    },
    {
        college: 'College of Science and Mathematics',
        programs: [
            'BS Biology',
            'BS Chemistry',
            'BS Mathematics',
            'BS Physics',
        ],
    },
    {
        college: 'College of Education',
        programs: [
            'Bachelor of Elementary Education',
            'Bachelor of Secondary Education',
        ],
    },
    {
        college: 'College of Arts and Social Sciences',
        programs: [
            'BA English Language Studies',
            'BA Filipino',
            'BA History',
            'BA Political Science',
            'BS Psychology',
        ],
    },
    {
        college: 'College of Economics, Business and Accountancy',
        programs: [
            'BS Accountancy',
            'BS Economics',
            'BS Business Administration',
        ],
    },
];

const ADDRESSES = [
    'Iligan City, LDN',
    'Cagayan de Oro City',
    'Marawi City, LDN',
    'Kauswagan, LDN',
    'Linamon, LDN',
    'Bacolod, LDN',
    'Maigo, LDN',
    'Kolambugan, LDN',
    'Tubod, LDN',
    'Lala, LDN',
    'Ozamiz City',
    'Tangub City',
    'Pagadian City',
    'Malaybalay City',
    'Valencia City, Bukidnon',
    'General Santos City',
    'Davao City',
    'Butuan City',
];

const RELIGIONS = [
    'Catholic',
    'Islam',
    'Protestant',
    'Christian',
    'Iglesia ni Cristo',
    '',
];

const RELATIONSHIPS = [
    'Mother',
    'Father',
    'Guardian',
    'Sister',
    'Brother',
    'Aunt',
    'Uncle',
];

const randomItem = (array) =>
    array[Math.floor(Math.random() * array.length)];

const randomNumber = (min, max) =>
    Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

const generatePhoneNumber = (index) => {
    return `09${String(
        100000000 + index
    ).padStart(9, '0')}`;
};

const generateBirthDate = (yearLevel) => {
    const currentYear = new Date().getFullYear();

    let age;

    switch (yearLevel) {
        case '1':
            age = randomNumber(17, 19);
            break;
        case '2':
            age = randomNumber(18, 20);
            break;
        case '3':
            age = randomNumber(19, 21);
            break;
        case '4':
            age = randomNumber(20, 23);
            break;
        case '5':
            age = randomNumber(21, 24);
            break;
        default:
            age = randomNumber(18, 24);
    }

    const year = currentYear - age;
    const month = randomNumber(0, 11);
    const day = randomNumber(1, 28);

    return new Date(year, month, day);
};

const createStudents = (count = 800) => {
    const students = [];

    for (let i = 1; i <= count; i++) {
        const yearLevel =
            randomItem([
                '1',
                '2',
                '3',
                '4',
                '5',
            ]);

        const admissionYear =
            2027 - Number(yearLevel);

        const studentNumber =
            String(i).padStart(4, '0');

        /*
         * Starts at 9000 so these synthetic IDs
         * are easy to recognize during testing.
         *
         * Example:
         * 2026-9001
         * 2026-9002
         */
        const idSuffix =
            9000 + i;

        const studentIdNumber =
            `${admissionYear}-${idSuffix}`;

        const firstName =
            randomItem(FIRST_NAMES);

        const middleName =
            randomItem(MIDDLE_NAMES);

        const lastName =
            randomItem(LAST_NAMES);

        const collegeData =
            randomItem(COLLEGE_PROGRAMS);

        const college =
            collegeData.college;

        const program =
            randomItem(
                collegeData.programs
            );

        const sex =
            Math.random() < 0.5
                ? 'Female'
                : 'Male';

        const gender =
            sex === 'Female'
                ? 'Woman'
                : 'Man';

        const permanentAddress =
            randomItem(ADDRESSES);

        const temporaryAddress =
            Math.random() < 0.65
                ? 'Iligan City, LDN'
                : permanentAddress;

        const emergencyFirstName =
            randomItem(FIRST_NAMES);

        const emergencyLastName =
            lastName;

        const email =
            `test.student${String(i).padStart(
                4,
                '0'
            )}@example.com`;

        students.push({
            studentIdNumber,

            firstName,

            middleName,

            lastName,

            email,

            contactNumber:
                generatePhoneNumber(i),

            college,

            program,

            temporaryAddress,

            permanentAddress,

            dateOfBirth:
                generateBirthDate(
                    yearLevel
                ),

            yearLevel,

            enrollmentStatus:
                'Enrolled',

            sex,

            gender,

            civilStatus:
                'Single',

            religion:
                randomItem(RELIGIONS),

            emergencyContactName:
                `${emergencyFirstName} ${emergencyLastName}`,

            emergencyContactNumber:
                generatePhoneNumber(
                    1000 + i
                ),

            emergencyContactRelationship:
                randomItem(
                    RELATIONSHIPS
                ),

            profileCompleted:
                true,

            isActive:
                true,

            isArchived:
                false,
        });
    }

    return students;
};

const seedStudents = async () => {
    try {
        const mongoUri =
            process.env.MONGO_URI ||
            process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error(
                'MONGO_URI or MONGODB_URI was not found in .env'
            );
        }

        console.log(
            'Connecting to MongoDB...'
        );

        await mongoose.connect(
            mongoUri
        );

        console.log(
            'Connected to MongoDB.'
        );

        const students =
            createStudents(800);

        /*
         * We intentionally do NOT delete
         * existing students.
         *
         * The generated test IDs and emails
         * use their own predictable range.
         */
        const operations =
            students.map((student) => ({
                updateOne: {
                    filter: {
                        studentIdNumber:
                            student.studentIdNumber,
                    },
                    update: {
                        $setOnInsert:
                            student,
                    },
                    upsert: true,
                },
            }));

        const result =
            await Student.bulkWrite(
                operations
            );

        console.log('');
        console.log(
            'Student seeding complete!'
        );

        console.log(
            `Inserted: ${result.upsertedCount}`
        );

        console.log(
            `Existing/skipped: ${
                800 -
                result.upsertedCount
            }`
        );

        console.log(
            'Total generated: 800'
        );
    } catch (error) {
        console.error(
            'Student seeding failed:'
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();

        console.log(
            'MongoDB connection closed.'
        );
    }
};

seedStudents();