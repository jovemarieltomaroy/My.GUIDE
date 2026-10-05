const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentIdNumber: {
            type: String,
            required: [true, 'Student ID number is required'],
            unique: true,
            trim: true,
            uppercase: true,
        },

        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },

        middleName: {
            type: String,
            trim: true,
            default: '',
        },

        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },

        email: {
            type: String,
            required: [true, 'Email address is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                'Please provide a valid email address',
            ],
        },

        contactNumber: {
            type: String,
            trim: true,
            default: '',
        },

        college: {
            type: String,
            trim: true,
            default: '',
        },

        program: {
            type: String,
            trim: true,
            default: '',
        },

        temporaryAddress: {
            type: String,
            trim: true,
            default: '',
        },
        permanentAddress: {
            type: String,
            trim: true,
            default: '',
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },

        yearLevel: {
            type: String,
            required: [true, 'Year level is required'],
            enum: {
                values: [
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                    'Graduate',
                    'Other',
                ],
                message: 'Please provide a valid year level',
            },
            trim: true,
        },

        enrollmentStatus: {
            type: String,
            enum: {
                values: [
                    'Enrolled',
                    'Not Enrolled',
                    'Leave of Absence',
                    'Graduated',
                    'Transferred',
                    'Withdrawn',
                    'Unknown',
                ],
                message: 'Please provide a valid enrollment status',
            },
            default: 'Unknown',
        },

        sex: {
            type: String,
            enum: {
                values: [
                    'Male',
                    'Female',
                    'Intersex',
                    'Prefer not to say',
                ],
                message: 'Please provide a valid sex value',
            },
        },

        gender: {
            type: String,
            trim: true,
            default: '',
        },

        civilStatus: {
            type: String,
            enum: {
                values: [
                    'Single',
                    'Married',
                    'Divorced',
                    'Widowed',
                    'Separated',
                    'Prefer not to say',
                ],
                message: 'Please provide a valid civil status',
            },
        },

        religion: {
            type: String,
            trim: true,
            default: '',
        },

        emergencyContactName: {
            type: String,
            trim: true,
            default: '',
        },

        emergencyContactNumber: {
            type: String,
            trim: true,
            default: '',
        },

        emergencyContactRelationship: {
            type: String,
            trim: true,
            default: '',
        },

        profileCompleted: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        isArchived: {
            type: Boolean,
            default: false,
        },

        archivedAt: {
            type: Date,
            default: null,
        },

        archivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        archiveReason: {
            type: String,
            trim: true,
            default: '',
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Student', studentSchema);