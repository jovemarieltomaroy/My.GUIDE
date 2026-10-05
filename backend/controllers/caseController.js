const { resolveInterventionAttachments } = require('../services/interventionAttachments');
const AsyncHandler = require('express-async-handler');
const Case = require('../models/case');
const Student = require('../models/student');
const User = require('../models/user');
const USER_ROLES = ['Counselor-Admin', 'Counselor-User'];
const transporter = require('../config/emailTransporter');
const { generateInterventionRecommendations, } = require("../services/rag/interventionRecommendationService");

const hasActiveTemporaryAccess = (
    caseRecord,
    userId
) => {
    const now =
        new Date();

    return (
        caseRecord
            .temporaryCounselor ||
        []
    ).some((access) => {
        const counselorId =
            access.counselor?._id ||
            access.counselor;

        const accessUntil =
            new Date(
                access.accessUntil
            );

        return (
            counselorId?.toString() ===
                userId.toString() &&
            access.isActive === true &&
            !access.revokedAt &&
            !Number.isNaN(
                accessUntil.getTime()
            ) &&
            accessUntil > now
        );
    });
};

const populateTemporaryAccessCase =
    async (caseId) => {
        return Case.findById(caseId)
            .populate(
                "student",
                `
                    firstName
                    middleName
                    lastName
                    email
                    studentIdNumber
                    college
                    program
                    yearLevel
                    contactNumber
                `
            )
            .populate(
                "assignedCounselor",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            )
            .populate(
                "temporaryCounselor.counselor",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                    isActive
                `
            )
            .populate(
                "temporaryCounselor.grantedBy",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            )
            .populate(
                "temporaryCounselor.revokedBy",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            )
            .populate(
                "updatedBy",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            );
};

const getAllCases = AsyncHandler(async (req, res) => {
    const {search} = req.query;
    let query = {isArchived: false};

    if(search){

    const matchingStudents = await Student.find({
        $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { middleName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { studentIdNumber: { $regex: search, $options: 'i' } },
            { program: { $regex: search, $options: 'i' } },
            { college: { $regex: search, $options: 'i' } },
            { yearLevel: { $regex: search, $options: 'i' } },  
        ]
    }).select('_id');

    const studentIds = matchingStudents.map(student => student._id);

        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { caseNumber: searchRegex },
            { 'problemAssessment.mainDomain': searchRegex },
            { student: { $in: studentIds } },
            { clientEntryType: { $regex: search, $options: 'i' } }, 
        ];
    }
    const cases = await Case.find(query)
         .populate(
                "student",
                `firstName
                middleName
                lastName
                studentIdNumber
                email
                college
                program
                yearLevel`)
        .populate(
            'assignedCounselor', 
            'firstName middleName lastName email role')
        .populate(
            'actionHistory.actionBy',
            'firstName lastName email role'
        )
        .populate(
            "temporaryCounselor.counselor",
            "firstName middleName lastName email role isActive"
        )
        .populate(
            "temporaryCounselor.grantedBy",
            "firstName middleName lastName email role"
        )
        .populate(
            "temporaryCounselor.revokedBy",
            "firstName middleName lastName email role"
        )
        .sort({ createdAt: -1 });

    res.status(200).json(cases);
});
const getMyCases = AsyncHandler(async (req, res) => {
    const {search} = req.query;
    let query = {isArchived: false, assignedCounselor: req.user._id};

    if(search){

    const matchingStudents = await Student.find({
        $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { middleName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { studentIdNumber: { $regex: search, $options: 'i' } },
            { program: { $regex: search, $options: 'i' } },
            { college: { $regex: search, $options: 'i' } },
            { yearLevel: { $regex: search, $options: 'i' } },  
        ]
    }).select('_id');

    const studentIds = matchingStudents.map(student => student._id);

        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { caseNumber: searchRegex },
            { 'problemAssessment.mainDomain': searchRegex },
            { student: { $in: studentIds } },
            { clientEntryType: { $regex: search, $options: 'i' } }, 
        ];
    }
    const cases = await Case.find(query)
        .populate(
                "student",
                `firstName
                middleName
                lastName
                studentIdNumber
                email
                college
                program
                yearLevel`)
        .populate('assignedCounselor', 'firstName middleName lastName email role')
        .sort({ createdAt: -1 });

    res.status(200).json(cases);
    
});
const getCaseById = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const foundCase =
        await populateTemporaryAccessCase(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message: "Case not found.",
        });
    }

    if (foundCase.isArchived) {
        return res.status(404).json({
            message: "Case not found.",
        });
    }

    const isAdmin =
        req.user.role === "Counselor-Admin";

    const assignedCounselorId =
        foundCase.assignedCounselor?._id ||
        foundCase.assignedCounselor;

    const isAssignedCounselor =
        assignedCounselorId &&
        assignedCounselorId.toString() ===
            req.user._id.toString();

    const hasTemporaryAccess =
        hasActiveTemporaryAccess(
            foundCase,
            req.user._id
        );

    if (
        !isAdmin &&
        !isAssignedCounselor &&
        !hasTemporaryAccess
    ) {
        return res.status(403).json({
            message:
                "Not authorized to view this case.",
        });
    }

    return res.status(200).json(foundCase);
});
// Lightweight preflight; case creation still checks again to prevent duplicates.
const getStudentActiveCase = AsyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.studentId)) {
        return res.status(400).json({ message: 'Invalid student ID.' });
    }
    const activeCase = await Case.findOne({
        student: req.params.studentId,
        caseStatus: { $nin: ['Closed', 'Terminated'] },
        isArchived: { $ne: true },
    }).select('_id createdBy assignedCounselor temporaryCounselor');
    if (!activeCase) return res.json({ exists: false });
    const canAddNotes = canManageRecommendations(activeCase, req.user) ||
        (req.user.role === 'Counselor-User' && hasActiveTemporaryAccess(activeCase, req.user._id));
    return res.json({ exists: true, canAddNotes, caseId: canAddNotes ? activeCase._id : null });
});

const createCase = AsyncHandler(async (req, res) => {
    const {
        student,
        assignedCounselor,
        clientEntryType,
        consent,
        referralInformation,
        currentPresentation,
        problemAssessment,
        backgroundAndPsychosocialHistory,
        mentalStatus,
        caseFormulation,
        interventionPlans,
    } = req.body;

    if (!student) {
        return res.status(400).json({
            message: 'Student is required.',
        });
    }

    const studentExists = await Student.findById(student);

    if (!studentExists) {
        return res.status(404).json({
            message: 'Student not found.',
        });
    }

    const allowedEntryTypes = [
        'Walk-in',
        'Referred',
        'Scheduled',
    ];

    if (
        !clientEntryType ||
        !allowedEntryTypes.includes(clientEntryType)
    ) {
        return res.status(400).json({
            message:
                'Client entry type must be Walk-in, Referred, or Scheduled.',
        });
    }

    /*
     * WALK-IN
     * Consent is collected directly during case creation.
     */
    if (clientEntryType !== 'Scheduled') {
        if (
            !consent?.hasConsent ||
            !consent?.confidentialityAgreementAccepted ||
            !consent?.dataPrivacyNoticeAccepted
        ) {
            return res.status(400).json({
                message:
                    'Consent, confidentiality agreement, and data privacy notice must be accepted for walk-in and referred cases.',
            });
        }
    }

    /*
     * REFERRED
     * A referral source must be provided.
     */
    if (clientEntryType === 'Referred') {
        if (!referralInformation?.referralSource) {
            return res.status(400).json({
                message:
                    'Referral source is required for referred cases.',
            });
        }
    }

    const existingActiveCase = await Case.findOne({
        student: studentExists._id,
        caseStatus: {
            $nin: [
                'Closed',
                'Terminated',
            ],
        },
        isArchived: {
            $ne: true,
        },
    })
        .populate(
            'assignedCounselor',
            'firstName middleName lastName email role'
        )
        .select(
            'caseNumber caseStatus assignedCounselor dateOpened isArchived'
        );

    if (existingActiveCase) {
        return res.status(409).json({
            message:
                `This student already has an active case (${existingActiveCase.caseNumber}). Close or terminate it before creating another case.`,
            activeCase: existingActiveCase,
        });
    }

    let finalAssignedCounselor = req.user._id;

    if (req.user.role === 'Counselor-Admin') {
        if (!assignedCounselor) {
            return res.status(400).json({
                message:
                    'Assigned counselor is required.',
            });
        }

        const counselor =
            await User.findById(assignedCounselor);

        if (!counselor) {
            return res.status(404).json({
                message:
                    'Assigned counselor not found.',
            });
        }

        if (
            !USER_ROLES.includes(
                counselor.role
            )
        ) {
            return res.status(400).json({
                message:
                    'Assigned counselor must have a valid counselor role.',
            });
        }

        if (counselor.isActive === false) {
            return res.status(400).json({
                message:
                    'Assigned counselor is inactive. Please assign an active counselor.',
            });
        }

        finalAssignedCounselor =
            assignedCounselor;
    }

    const currentYear =
        new Date().getFullYear();

    let newCaseNumber =
        `CASE-${currentYear}-0001`;

    const latestCase =
        await Case.findOne({
            caseNumber: {
                $regex:
                    `^CASE-${currentYear}-`,
            },
        }).sort({
            createdAt: -1,
        });

    if (
        latestCase &&
        latestCase.caseNumber
    ) {
        const latestNumber =
            parseInt(
                latestCase.caseNumber.split(
                    '-'
                )[2],
                10
            );

        const nextNumber =
            latestNumber + 1;

        newCaseNumber =
            `CASE-${currentYear}-${nextNumber
                .toString()
                .padStart(4, '0')}`;
    }

    const normalizedConsent = {
        ...consent,
    };

    if (consent?.hasConsent) {
        normalizedConsent.consentDate =
            consent.consentDate
                ? new Date(
                      consent.consentDate
                  )
                : new Date();
    }

    const newCase =
        await Case.create({
            caseNumber:
                newCaseNumber,

            student,

            assignedCounselor:
                finalAssignedCounselor,

            caseStatus:
                'Open',

            clientEntryType,

            consent:
                normalizedConsent,

            referralInformation:
                clientEntryType ===
                'Referred'
                    ? referralInformation
                    : referralInformation ||
                      undefined,

            currentPresentation,

            problemAssessment,

            backgroundAndPsychosocialHistory,

            mentalStatus,

            caseFormulation,

            interventionPlans,

            dateOpened:
                new Date(),

            createdBy:
                req.user._id,

            actionHistory: [
                {
                    action:
                        'Created',

                    remarks:
                        `Case created as ${clientEntryType}.`,

                    toCounselor:
                        finalAssignedCounselor,

                    actionBy:
                        req.user._id,

                    actionDate:
                        new Date(),
                },
            ],
        });

    const populatedCase =
        await Case.findById(
            newCase._id
        )
            .populate(
                'student',
                'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
            )
            .populate(
                'assignedCounselor',
                'firstName middleName lastName email role'
            )
            .populate(
                'createdBy',
                'firstName middleName lastName email role'
            );

    return res.status(201).json({
        message:
            'Case created successfully.',
        case:
            populatedCase,
    });
});

const updateCase = AsyncHandler(async (req, res) => {
    const caseId =
        req.params.id;

    const foundCase =
        await Case.findById(caseId)
            .populate(
                'student',
                'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
            )
            .populate(
                'assignedCounselor',
                'firstName middleName lastName email role'
            );

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(403).json({
            message:
                'Archived cases cannot be updated.',
        });
    }

    if (
        !canManageRecommendations(foundCase, req.user)
    ) {
        return res.status(403).json({
            message:
                'Not authorized to update this case.',
        });
    }

    /*
     * Validate client entry type only when
     * the request is trying to change it.
     */
    if (
        req.body.clientEntryType !==
        undefined
    ) {
        const allowedEntryTypes = [
            'Walk-in',
            'Referred',
            'Scheduled',
        ];

        if (
            !allowedEntryTypes.includes(
                req.body.clientEntryType
            )
        ) {
            return res.status(400).json({
                message:
                    'Client entry type must be Walk-in, Referred, or Scheduled.',
            });
        }

        if (
            req.body.clientEntryType ===
                'Referred' &&
            !(
                req.body
                    .referralInformation
                    ?.referralSource ||
                foundCase
                    .referralInformation
                    ?.referralSource
            )
        ) {
            return res.status(400).json({
                message:
                    'Referral source is required for referred cases.',
            });
        }
    }

    const originalConsentDate = foundCase.consent?.consentDate;
    const mergeFields = (existing, patch) => {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
        const result = { ...existing };
        for (const [key, value] of Object.entries(patch)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
            result[key] = mergeFields(result[key], value);
        }
        return result;
    };
    const existingCase = foundCase.toObject();

    const allowedFields = [
        'clientEntryType',
        'consent',
        'referralInformation',
        'currentPresentation',
        'problemAssessment',
        'backgroundAndPsychosocialHistory',
        'mentalStatus',
        'caseFormulation',
        'interventionPlans',
    ];

    for (
        const field of allowedFields
    ) {
        if (
            req.body[field] !==
            undefined
        ) {
            foundCase[field] = mergeFields(existingCase[field], req.body[field]);
        }
    }

    /*
     * Preserve the original consent date.
     * Only create one when consent becomes
     * accepted and no date exists yet.
     */
    if (originalConsentDate && foundCase.consent) {
        foundCase.consent.consentDate = originalConsentDate;
    }

    if (
        req.body.consent
            ?.hasConsent &&
        !foundCase.consent
            ?.consentDate
    ) {
        foundCase.consent.consentDate =
            new Date();
    }

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Updated',

        remarks:
            'Case record details updated.',

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await Case.findById(
            foundCase._id
        )
            .populate(
                'student',
                'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
            )
            .populate(
                'assignedCounselor',
                'firstName middleName lastName email role'
            )
            .populate(
                'updatedBy',
                'firstName middleName lastName email role'
            );

    return res.status(200).json({
        message:
            'Case updated successfully.',
        case:
            updatedCase,
    });
});

const updateCaseStatus = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const {
        caseStatus,
        closingRemarks,
        terminationReason,
    } = req.body;

    const foundCase = await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message: 'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(403).json({
            message: 'Archived cases cannot be updated.',
        });
    }

    const isAdmin =
        req.user.role === 'Counselor-Admin';

    const isAssignedCounselor =
        foundCase.assignedCounselor &&
        foundCase.assignedCounselor.toString() ===
            req.user._id.toString();

    if (!isAdmin && !isAssignedCounselor) {
        return res.status(403).json({
            message:
                'Not authorized to update this case status.',
        });
    }

    const allowedStatuses = [
        'Open',
        'In Progress',
        'For Follow-up',
        'Closed',
        'Terminated',
    ];

    const activeStatuses = [
        'Open',
        'In Progress',
        'For Follow-up',
    ];

    if (!caseStatus) {
        return res.status(400).json({
            message: 'Case status is required.',
        });
    }

    if (!allowedStatuses.includes(caseStatus)) {
        return res.status(400).json({
            message: 'Invalid case status.',
        });
    }

    const isChangingToActiveStatus =
        activeStatuses.includes(caseStatus);

    const wasPreviouslyInactive =
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        );

    if (
        isChangingToActiveStatus &&
        wasPreviouslyInactive
    ) {
        const anotherActiveCase =
            await Case.findOne({
                _id: {
                    $ne: foundCase._id,
                },

                student:
                    foundCase.student,

                caseStatus: {
                    $in: activeStatuses,
                },

                isArchived: false,
            })
                .populate(
                    'assignedCounselor',
                    'firstName middleName lastName email role'
                )
                .select(
                    'caseNumber caseStatus assignedCounselor dateOpened'
                );

        if (anotherActiveCase) {
            return res.status(409).json({
                message:
                    'This student already has another active case. Close or terminate the active case before reopening this one.',

                activeCase:
                    anotherActiveCase,
            });
        }
    }

    if (caseStatus === 'Closed') {
        if (
            !closingRemarks ||
            closingRemarks.trim() === ''
        ) {
            return res.status(400).json({
                message:
                    'Closing remarks are required.',
            });
        }

        foundCase.dateClosed =
            new Date();

        foundCase.closingRemarks =
            closingRemarks.trim();

        foundCase.terminatedAt =
            null;

        foundCase.terminationReason =
            null;
    }

    if (caseStatus === 'Terminated') {
        if (
            !terminationReason ||
            terminationReason.trim() === ''
        ) {
            return res.status(400).json({
                message:
                    'Termination reason is required.',
            });
        }

        foundCase.dateClosed =
            new Date();

        foundCase.terminatedAt =
            new Date();

        foundCase.terminationReason =
            terminationReason.trim();

        foundCase.closingRemarks =
            null;
    }

    if (
        activeStatuses.includes(caseStatus)
    ) {
        foundCase.dateClosed =
            null;

        foundCase.closingRemarks =
            null;

        foundCase.terminatedAt =
            null;

        foundCase.terminationReason =
            null;
    }

    const previousStatus =
        foundCase.caseStatus;

    foundCase.caseStatus =
        caseStatus;

    foundCase.updatedBy =
        req.user._id;

    let action = 'Updated';

    if (caseStatus === 'Closed') {
        action = 'Closed';
    } else if (
        caseStatus === 'Terminated'
    ) {
        action = 'Terminated';
    } else if (
        caseStatus === 'For Follow-up'
    ) {
        action = 'Follow-up';
    } else if (
        caseStatus === 'Open' &&
        ['Closed', 'Terminated'].includes(
            previousStatus
        )
    ) {
        action = 'Reopened';
    }

    foundCase.actionHistory.push({
        action,

        remarks:
            caseStatus === 'Closed'
                ? closingRemarks.trim()
                : caseStatus === 'Terminated'
                  ? terminationReason.trim()
                  : `Case status changed from ${previousStatus} to ${caseStatus}.`,

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await Case.findById(
            foundCase._id
        )
            .populate(
                'student',
                'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
            )
            .populate(
                'assignedCounselor',
                'firstName middleName lastName email role'
            )
            .populate(
                'updatedBy',
                'firstName middleName lastName email role'
            );

    return res.status(200).json({
        message:
            'Case status updated successfully.',

        case:
            updatedCase,
    });
});
const assignCounselor = AsyncHandler(async (req, res)=> {
    const caseId = req.params.id;

    const { assignedCounselor, remarks } = req.body;

    const foundCase = await Case.findById(caseId);

    if (!foundCase){
        return res.status(404).json({ message: 'Case not found.'});
    }
    if (foundCase.isArchived){
        return res.status(400).json({ message: 'Archived cases cannot be reassigned.'});
    }

    const isAdmin = req.user.role === 'Counselor-Admin';

    if (!isAdmin){
        return res.status(403).json({message: 'Not authorized to this action.'});
    }
    if (!assignedCounselor){
        return res.status(400).json({ message: 'Assigned counselor is required.'});
    }

    const newCounselor = await User.findById(assignedCounselor);
    
    if (!newCounselor){
        return res.status(404).json({ message: 'New counselor not found.'});
    }
    if (!USER_ROLES.includes(newCounselor.role)){
        return res.status(400).json({ message: 'Selected user is not a valid counselor.'});
    }
    if (!newCounselor.isActive){
        return res.status(400).json({message: 'Cases can only be assigned to active accounts.'});
    }
    const previousCounselor = foundCase.assignedCounselor;

    if (previousCounselor?.toString() === assignedCounselor.toString()) {
        return res.status(400).json({ message: 'Case is already assigned to this counselor.' });
    }


    foundCase.assignedCounselor = assignedCounselor;
    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: 'Reassigned',
        remarks: remarks || 'Assigned counselor is updated.',
        actionBy: req.user._id,
        actionDate: new Date(),
        fromCounselor : previousCounselor,
        toCounselor : assignedCounselor,

    });

  await foundCase.save()

  const assignNewCounselor = await Case.findById(foundCase._id)
        .populate( 'student', 'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber')
        .populate('assignedCounselor', 'firstName middleName lastName email role')
        .populate('updatedBy', 'firstName middleName lastName email role');

        res.status(200).json({
            message:'Assigned counselor is updated',
            case: assignNewCounselor    
        }); 

});
const grantTemporaryAccess =
    AsyncHandler(
        async (req, res) => {
            const caseId =
                req.params.id;

            const {
                temporaryCounselor,
                reason,
                accessUntil,
            } = req.body;

            const foundCase =
                await Case.findById(
                    caseId
                );

            if (!foundCase) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Case not found.",
                    });
            }

            if (
                foundCase.isArchived
            ) {
                return res
                    .status(403)
                    .json({
                        message:
                            "Archived cases cannot be granted temporary access.",
                    });
            }

            if (
                [
                    "Closed",
                    "Terminated",
                ].includes(
                    foundCase.caseStatus
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Closed or terminated cases cannot be granted temporary access.",
                    });
            }

            const isAdmin =
                req.user.role ===
                "Counselor-Admin";

            const isAssignedCounselor =
                foundCase.assignedCounselor &&
                foundCase.assignedCounselor.toString() ===
                    req.user._id.toString();

            if (
                !isAdmin &&
                !isAssignedCounselor
            ) {
                return res
                    .status(403)
                    .json({
                        message:
                            "Not authorized to grant temporary access.",
                    });
            }

            if (
                !temporaryCounselor
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Temporary counselor is required.",
                    });
            }
            const counselor =
                await User.findById(
                    temporaryCounselor
                );

            if (!counselor) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Counselor not found.",
                    });
            }
            if (
                temporaryCounselor.toString() ===
                req.user._id.toString()
            ) {
                return res.status(400).json({
                    message:
                        "You cannot grant temporary access to your own account.",
                });
            }
            if (
                !USER_ROLES.includes(
                    counselor.role
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Selected user is not a valid counselor.",
                    });
            }

            if (
                !counselor.isActive
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Access can only be granted to active accounts.",
                    });
            }

            if (
                foundCase.assignedCounselor &&
                temporaryCounselor.toString() ===
                    foundCase.assignedCounselor.toString()
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Case is already assigned to this counselor.",
                    });
            }

            const normalizedReason =
                String(
                    reason || ""
                ).trim();

            if (
                !normalizedReason
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Reason is required to grant temporary access.",
                    });
            }

            if (!accessUntil) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Access-until date is required.",
                    });
            }

            const now =
                new Date();

            const accessUntilDate =
                new Date(
                    accessUntil
                );

            if (
                Number.isNaN(
                    accessUntilDate.getTime()
                ) ||
                accessUntilDate <= now
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Access until must be a valid future date.",
                    });
            }

            const alreadyHasAccess =
                (
                    foundCase
                        .temporaryCounselor ||
                    []
                ).some(
                    (access) => {
                        const counselorId =
                            access
                                .counselor
                                ?._id ||
                            access
                                .counselor;

                        const storedAccessUntil =
                            new Date(
                                access.accessUntil
                            );

                        return (
                            counselorId?.toString() ===
                                temporaryCounselor.toString() &&
                            access.isActive ===
                                true &&
                            !access.revokedAt &&
                            !Number.isNaN(
                                storedAccessUntil.getTime()
                            ) &&
                            storedAccessUntil >
                                now
                        );
                    }
                );

            if (
                alreadyHasAccess
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "This counselor already has active temporary access to this case.",
                    });
            }

            foundCase
                .temporaryCounselor
                .push({
                    counselor:
                        temporaryCounselor,

                    grantedBy:
                        req.user._id,

                    reason:
                        normalizedReason,

                    accessUntil:
                        accessUntilDate,

                    isActive:
                        true,

                    grantedAt:
                        now,

                    revokedAt:
                        null,

                    revokedBy:
                        null,

                    revocationReason:
                        "",
                });

            foundCase.updatedBy =
                req.user._id;

            foundCase
                .actionHistory
                .push({
                    action:
                        "Temporary Access Granted",

                    remarks:
                        `Temporary access granted to ${counselor.email}. Reason: ${normalizedReason}`,

                    actionBy:
                        req.user._id,

                    actionDate:
                        now,

                    fromCounselor:
                        foundCase
                            .assignedCounselor,

                    toCounselor:
                        temporaryCounselor,
                });

            await foundCase.save();

            const updatedCase =
                await populateTemporaryAccessCase(
                    foundCase._id
                );

            return res
                .status(200)
                .json({
                    message:
                        "Temporary access granted successfully.",

                    case:
                        updatedCase,
                });
});
const revokeTemporaryAccess =
    AsyncHandler(
        async (req, res) => {
            const {
                id: caseId,
                accessId,
            } = req.params;

            const {
                revocationReason,
            } = req.body;

            const foundCase =
                await Case.findById(
                    caseId
                );

            if (!foundCase) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Case not found.",
                    });
            }

            const isAdmin =
                req.user.role ===
                "Counselor-Admin";

            const isAssignedCounselor =
                foundCase.assignedCounselor &&
                foundCase.assignedCounselor.toString() ===
                    req.user._id.toString();

            if (
                !isAdmin &&
                !isAssignedCounselor
            ) {
                return res
                    .status(403)
                    .json({
                        message:
                            "Not authorized to revoke temporary access.",
                    });
            }

            const accessRecord =
                foundCase
                    .temporaryCounselor
                    .id(accessId);

            if (!accessRecord) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Temporary-access record not found.",
                    });
            }

            if (
                accessRecord.isActive !==
                    true ||
                accessRecord.revokedAt
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Temporary access is already inactive or revoked.",
                    });
            }

            const accessUntilDate =
                new Date(
                    accessRecord.accessUntil
                );

            const alreadyExpired =
                !Number.isNaN(
                    accessUntilDate.getTime()
                ) &&
                accessUntilDate <=
                    new Date();

            if (alreadyExpired) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Temporary access has already expired.",
                    });
            }

            const normalizedReason =
                String(
                    revocationReason ||
                        ""
                ).trim();

            if (
                !normalizedReason
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Revocation reason is required.",
                    });
            }

            const temporaryCounselorId =
                accessRecord
                    .counselor
                    ?._id ||
                accessRecord
                    .counselor;

            const now =
                new Date();

            accessRecord.isActive =
                false;

            accessRecord.revokedAt =
                now;

            accessRecord.revokedBy =
                req.user._id;

            accessRecord.revocationReason =
                normalizedReason;

            foundCase.updatedBy =
                req.user._id;

            foundCase
                .actionHistory
                .push({
                    action:
                        "Temporary Access Revoked",

                    remarks:
                        `Temporary access revoked. Reason: ${normalizedReason}`,

                    actionBy:
                        req.user._id,

                    actionDate:
                        now,

                    fromCounselor:
                        temporaryCounselorId,

                    toCounselor:
                        foundCase
                            .assignedCounselor,
                });

            await foundCase.save();

            const updatedCase =
                await populateTemporaryAccessCase(
                    foundCase._id
                );

            return res
                .status(200)
                .json({
                    message:
                        "Temporary access revoked successfully.",

                    case:
                        updatedCase,
                });
});
const addProgressNotes = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const {
        progressStatus,
        progressSummary,
        actionTaken,
        newPlanOfAction,
        timeSpan,
        remarks,
        interventionProgress,
    } = req.body;

    const foundCase = await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message: 'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(403).json({
            message: 'Archived cases cannot have new progress notes.',
        });
    }

    if (['Closed', 'Terminated'].includes(foundCase.caseStatus)) {
        return res.status(400).json({
            message:
                'Progress notes cannot be added to closed or terminated cases.',
        });
    }

    const isAdmin = req.user.role === 'Counselor-Admin';

    const isAssignedCounselor =
        foundCase.assignedCounselor &&
        foundCase.assignedCounselor.toString() ===
            req.user._id.toString();

    const hasTemporaryAccess =
        hasActiveTemporaryAccess(
            foundCase,
            req.user._id
    );
    if (
        !isAdmin &&
        !isAssignedCounselor &&
        !hasTemporaryAccess
    ) {
        return res.status(403).json({
            message:
                'Not authorized to add progress notes to this case.',
        });
    }

    if (
        !progressSummary ||
        typeof progressSummary !== 'string' ||
        progressSummary.trim() === ''
    ) {
        return res.status(400).json({
            message: 'Progress summary is required.',
        });
    }

    const allowedProgressStatuses = [
        'Improved',
        'No Progress',
        'Worsened',
        'Needs Follow-up',
    ];

    const finalProgressStatus =
        progressStatus || 'Needs Follow-up';

    if (
        !allowedProgressStatuses.includes(
            finalProgressStatus
        )
    ) {
        return res.status(400).json({
            message: 'Invalid progress status.',
        });
    }

    const allowedStudentResponses = [
        'Positive Response',
        'Mixed Response',
        'No Noticeable Change',
        'Negative Response',
        'Not Assessed',
    ];

    const allowedGoalProgress = [
        'No Progress Observed',
        'Slight Progress',
        'Moderate Progress',
        'Goal Mostly Achieved',
        'Goal Achieved',
        'Not Assessed',
    ];

    const allowedPlanActions = [
        'Continue Current Plan',
        'Continue With Adjustments',
        'Revise Intervention Plan',
        'Complete Intervention Plan',
        'Refer for Additional Support',
        'Not Decided',
    ];

    let normalizedInterventionProgress = {
        interventionPlan: null,
        studentResponse: 'Not Assessed',
        goalProgress: 'Not Assessed',
        recommendedPlanAction: 'Not Decided',
        supportingNote: '',
    };

    if (
        interventionProgress &&
        typeof interventionProgress === 'object'
    ) {
        const {
            interventionPlan,
            studentResponse,
            goalProgress,
            recommendedPlanAction,
            supportingNote,
        } = interventionProgress;

        if (
            studentResponse &&
            !allowedStudentResponses.includes(studentResponse)
        ) {
            return res.status(400).json({
                message: 'Invalid student response.',
            });
        }

        if (
            goalProgress &&
            !allowedGoalProgress.includes(goalProgress)
        ) {
            return res.status(400).json({
                message: 'Invalid goal progress value.',
            });
        }

        if (
            recommendedPlanAction &&
            !allowedPlanActions.includes(
                recommendedPlanAction
            )
        ) {
            return res.status(400).json({
                message:
                    'Invalid recommended intervention plan action.',
            });
        }

        if (interventionPlan) {
            const selectedPlan =
                foundCase.interventionPlans.id(
                    interventionPlan
                );

            if (!selectedPlan) {
                return res.status(400).json({
                    message:
                        'The selected intervention plan does not belong to this case.',
                });
            }
        }

        normalizedInterventionProgress = {
            interventionPlan:
                interventionPlan || null,

            studentResponse:
                studentResponse || 'Not Assessed',

            goalProgress:
                goalProgress || 'Not Assessed',

            recommendedPlanAction:
                recommendedPlanAction ||
                'Not Decided',

            supportingNote:
                typeof supportingNote === 'string'
                    ? supportingNote.trim()
                    : '',
        };
    }

    foundCase.progressNotes.push({
        progressStatus: finalProgressStatus,

        progressSummary:
            progressSummary.trim(),

        actionTaken:
            typeof actionTaken === 'string'
                ? actionTaken.trim()
                : '',

        newPlanOfAction:
            typeof newPlanOfAction === 'string'
                ? newPlanOfAction.trim()
                : '',

        timeSpan:
            typeof timeSpan === 'string'
                ? timeSpan.trim()
                : '',

        remarks:
            typeof remarks === 'string'
                ? remarks.trim()
                : '',

        interventionProgress:
            normalizedInterventionProgress,

        attendingCounselor:
            req.user._id,

        addedBy:
            req.user._id,

        noteDate:
            new Date(),
    });

    if (
        foundCase.caseStatus === 'Open' &&
        finalProgressStatus !== 'Needs Follow-up'
    ) {
        foundCase.caseStatus = 'In Progress';
    }

    if (
        finalProgressStatus === 'Needs Follow-up'
    ) {
        foundCase.caseStatus = 'For Follow-up';
    }

    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: 'Follow-up',
        remarks: `Progress note added (${finalProgressStatus}).`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });

    await foundCase.save();

    const updatedCase = await Case.findById(
        foundCase._id
    )
        .populate(
            'student',
            `
                firstName
                middleName
                lastName
                email
                studentIdNumber
                college
                program
                yearLevel
                contactNumber
            `
        )
        .populate(
            'assignedCounselor',
            `
                firstName
                middleName
                lastName
                email
                role
            `
        )
        .populate(
            'progressNotes.attendingCounselor',
            `
                firstName
                middleName
                lastName
                email
                role
            `
        )
        .populate(
            'progressNotes.addedBy',
            `
                firstName
                middleName
                lastName
                email
                role
            `
        )
        .populate(
            'updatedBy',
            `
                firstName
                middleName
                lastName
                email
                role
            `
        );

    res.status(200).json({
        message:
            'Progress note added successfully.',
        case: updatedCase,
    });
});
const archiveCase = AsyncHandler(async (req,res) => {

    const caseId = req.params.id;
    const foundCase = await Case.findById(caseId);

    if (!foundCase){
        return res.status(404).json({ message: 'Case not found.'});
    }
    if (foundCase.isArchived){
        return res.status(400).json({ message: 'Case is already archived.'});
    }
    const isAdmin = req.user.role === 'Counselor-Admin';
    if (!isAdmin){
        return res.status(403).json({ message: 'Only admins are authorized to archive cases.'});
    }
    const archivableStatuses = ['Closed', 'Terminated'];
    if (!archivableStatuses.includes(foundCase.caseStatus)){
        return res.status(400).json({ message: 'Only closed or terminated cases can be archived.'})
    }
    foundCase.isArchived = true;
    foundCase.archivedBy = req.user._id;
    foundCase.archivedAt = new Date();
    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: 'Archived',
        remarks: `Case archived by administrator.`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });
    await foundCase.save();
    const updatedCase = await Case.findById(foundCase._id)
        .populate( 
            'student', 
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor', 
            'firstName middleName lastName email role'
        )
        .populate(
            'archivedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'updatedBy', 
            'firstName middleName lastName email role'
        );
        res.status(200).json({
            message:'Case archived successfully.',
            case: updatedCase
        }); 
});
const restoreCase = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const foundCase = await Case.findById(caseId);

    if (!foundCase){
        return res.status(404).json({ message: 'Case not found.'});
    }
    if (!foundCase.isArchived){
        return res.status(400).json({ message: 'Case is not archived.'});
    }

    const isAdmin = req.user.role === 'Counselor-Admin';

    if(!isAdmin){
        return res.status(403).json({ message: 'Only admins can restore cases.'});
    }

    foundCase.isArchived = false;
    foundCase.updatedBy = req.user._id;
    foundCase.archivedAt = null;
    foundCase.archivedBy = null;

    foundCase.actionHistory.push({
        action: 'Restored',
        remarks: `Case restored successfully.`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });

    await foundCase.save();

    const updatedCase = await Case.findById(foundCase._id)
        .populate( 
            'student', 
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor', 
            'firstName middleName lastName email role'
        )
        .populate(
            'updatedBy', 
            'firstName middleName lastName email role'
        );
 res.status(200).json({
            message:'Case restored successfully.',
            case: updatedCase
   }); 
});
const approveInterventionPlan = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const planId = req.params.planId;

    const foundCase = await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message: 'Case not found.'
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message: 'Archived cases cannot have intervention plans approved.'
        });
    }

    if (['Closed', 'Terminated'].includes(foundCase.caseStatus)) {
        return res.status(400).json({
            message: 'Intervention plans can only be approved while the case is active.'
        });
    }

    const isAssignedCounselor =
        foundCase.assignedCounselor &&
        foundCase.assignedCounselor.toString() === req.user._id.toString();

    if (!isAssignedCounselor) {
        return res.status(403).json({
            message: 'Not authorized to approve intervention plans.'
        });
    }

    if (!planId) {
        return res.status(400).json({
            message: 'Intervention plan ID is required.'
        });
    }

    const interventionPlan = foundCase.interventionPlans.id(planId);

    if (!interventionPlan){
        return res.status(404).json({ message: 'Intervention plan does not exist.'});
    }
    if (interventionPlan.approvalStatus === 'Approved'){
        return res.status(400).json({ message: 'Intervention plan is already approved.'});
    }
    if (interventionPlan.approvalStatus === 'Rejected'){
        return res.status(400).json({ message: 'Intervention plan has already been rejected.'});
    }
   if (
        !interventionPlan.problem?.trim() ||
        !interventionPlan.planOfAction?.trim()
    ) {
        return res.status(400).json({
            message: 'Intervention plan is incomplete and cannot be approved.'
        });
    }

    interventionPlan.approvalStatus = 'Approved';
    interventionPlan.reviewedBy = req.user._id;
    interventionPlan.reviewedAt = new Date();
    
    if (!['Ongoing', 'Completed'].includes(interventionPlan.status)){
        interventionPlan.status = 'Planned';
    }

    interventionPlan.isSentToStudent = false;
    interventionPlan.sentAt = null;
    interventionPlan.sentBy = null;
    interventionPlan.sentToEmail = null;

    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: 'Updated',
        remarks: `Intervention plan approved.`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });

    await foundCase.save();
      const updatedCase = await Case.findById(foundCase._id)
        .populate( 
            'student', 
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor', 
            'firstName middleName lastName email role'
        )
        .populate(
            'interventionPlans.reviewedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'updatedBy', 
            'firstName middleName lastName email role'
        );
        res.status(200).json({
            message:'Intervention plan approved successfully.',
            case: updatedCase
        }); 
});
const reviseInterventionPlan = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;
    const planId = req.params.planId;

    const {
        problem,
        goal,
        planOfAction,
        timeSpan,
        resources,
        followUpPlan,
        remarks,
    } = req.body;

    const foundCase = await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message: 'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message:
                'Cannot revise intervention plans for archived cases.',
        });
    }

    if (
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Cannot revise intervention plans for non-active cases.',
        });
    }

    const isAssignedCounselor =
        foundCase.assignedCounselor &&
        foundCase.assignedCounselor.toString() ===
            req.user._id.toString();

    if (!isAssignedCounselor) {
        return res.status(403).json({
            message:
                'Not authorized to revise intervention plans.',
        });
    }

    if (!planId) {
        return res.status(400).json({
            message:
                'Intervention plan ID is required.',
        });
    }

    const interventionPlan =
        foundCase.interventionPlans.id(planId);

    if (!interventionPlan) {
        return res.status(404).json({
            message:
                'Intervention plan does not exist.',
        });
    }

    if (
        ['Completed', 'Cancelled'].includes(
            interventionPlan.status
        )
    ) {
        return res.status(400).json({
            message:
                'Cannot revise completed or cancelled intervention plans.',
        });
    }

    if (problem !== undefined) {
        interventionPlan.problem =
            problem;
    }

    if (goal !== undefined) {
        interventionPlan.goal =
            goal;
    }

    if (planOfAction !== undefined) {
        interventionPlan.planOfAction =
            planOfAction;
    }

    if (timeSpan !== undefined) {
        interventionPlan.timeSpan =
            timeSpan;
    }

    if (followUpPlan !== undefined) {
        interventionPlan.followUpPlan =
            followUpPlan;
    }

    if (remarks !== undefined) {
        interventionPlan.remarks =
            remarks;
    }
    if (resources !== undefined) {
        if (!Array.isArray(resources)) {
            return res.status(400).json({
                message:
                    'Resources must be an array.',
            });
        }

        interventionPlan.resources =
            resources;
    }

    if (
        !interventionPlan.problem?.trim() ||
        !interventionPlan.planOfAction?.trim()
    ) {
        return res.status(400).json({
            message:
                'Problem and plan of action are required.',
        });
    }

    interventionPlan.approvalStatus =
        'Revised';

    interventionPlan.reviewedBy =
        req.user._id;

    interventionPlan.reviewedAt =
        new Date();

    interventionPlan.status =
        'Planned';

    interventionPlan.isSentToStudent =
        false;

    interventionPlan.sentAt =
        null;

    interventionPlan.sentBy =
        null;

    interventionPlan.sentToEmail =
        null;

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Updated',

        remarks:
            'Intervention plan revised by assigned counselor.',

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await Case.findById(
            foundCase._id
        )
            .populate(
                'student',
                'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
            )
            .populate(
                'assignedCounselor',
                'firstName middleName lastName email role'
            )
            .populate(
                'interventionPlans.reviewedBy',
                'firstName middleName lastName email role'
            )
            .populate(
                'updatedBy',
                'firstName middleName lastName email role'
            );

    return res.status(200).json({
        message:
            'Intervention plan revised successfully.',

        case:
            updatedCase,
    });
});
const rejectInterventionPlan = AsyncHandler( async (req, res) => {
    const caseId = req.params.id;
    const planId = req.params.planId;
    const { rejectionReason } = req.body;

    const foundCase = await Case.findById(caseId);
    if (!foundCase){
        return res.status(404).json({ message: 'Case does not exist.'});
    }
    if (foundCase.isArchived){
        return res.status(400).json({ message: 'Cannot reject intervention plans for archived cases.'});
    }
    if (['Closed', 'Terminated'].includes(foundCase.caseStatus)){
        return res.status(400).json({ message: 'Cannot review intervention plans for non-active cases.'});
    }

    const isAssignedCounselor = foundCase.assignedCounselor && 
                foundCase.assignedCounselor.toString() === req.user._id.toString();
    
    if (!isAssignedCounselor){
        return res.status(403).json({ message: 'Not authorized to reject intervention plans.'});
    }
    if (!planId){
        return res.status(400).json({ message: 'Intervention plan id does not exist.'});
    }

    const interventionPlan = foundCase.interventionPlans.id(planId);
    if (!interventionPlan){
        return res.status(404).json({ message: 'Intervention plan does not exist.'});
    }
    if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ message: 'Rejection reason is required.'});
    }
    if (interventionPlan.approvalStatus === 'Rejected'){
        return res.status(400).json({ message: 'Intervention plan is already rejected.'});
    }
    if (interventionPlan.isSentToStudent){
        return res.status(400).json({ message: 'Intervention plan has already been sent to the student.'})
    }

    interventionPlan.approvalStatus = 'Rejected';
    interventionPlan.reviewedBy = req.user._id;
    interventionPlan.reviewedAt = new Date();
    interventionPlan.rejectionReason = rejectionReason;

    interventionPlan.status = 'Cancelled';

    interventionPlan.isSentToStudent = false;
    interventionPlan.sentAt = null;
    interventionPlan.sentBy = null;
    interventionPlan.sentToEmail = null;

    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: 'Updated',
        remarks: `Intervention plan rejected. Reason: ${rejectionReason}`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });

    await foundCase.save();

    const updatedCase = await Case.findById(foundCase._id)
        .populate( 
            'student', 
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor', 
            'firstName middleName lastName email role'
        )
        .populate(
            'interventionPlans.reviewedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'updatedBy', 
            'firstName middleName lastName email role'
        );
    res.status(200).json({
        message:'Intervention plan rejected successfully.',
        case: updatedCase
     }); 
});
const sendApprovedInterventionPlan = AsyncHandler(
    async (req, res) => {
        const caseId = req.params.id;
        const planId = req.params.planId;

        const foundCase = await Case.findById(caseId)
            .populate('student');

        if (!foundCase) {
            return res.status(404).json({
                message: 'Case does not exist.',
            });
        }

        if (foundCase.isArchived) {
            return res.status(400).json({
                message:
                    'Archived cases cannot send intervention plans.',
            });
        }

        if (
            ['Closed', 'Terminated'].includes(
                foundCase.caseStatus
            )
        ) {
            return res.status(400).json({
                message:
                    'Counselors cannot send intervention plans to non-active cases.',
            });
        }

        const isAssignedCounselor =
            foundCase.assignedCounselor &&
            foundCase.assignedCounselor.toString() ===
                req.user._id.toString();

        if (!isAssignedCounselor) {
            return res.status(403).json({
                message:
                    'Not authorized to send intervention plans.',
            });
        }

        if (!planId) {
            return res.status(400).json({
                message:
                    'Intervention plan ID is required.',
            });
        }

        const interventionPlan =
            foundCase.interventionPlans.id(planId);

        if (!interventionPlan) {
            return res.status(404).json({
                message:
                    'Intervention plan does not exist.',
            });
        }

        if (
            interventionPlan.approvalStatus !==
            'Approved'
        ) {
            return res.status(400).json({
                message:
                    'Only approved intervention plans can be sent.',
            });
        }

        if (interventionPlan.isSentToStudent) {
            return res.status(400).json({
                message:
                    'Intervention plan has already been sent.',
            });
        }

        if (!foundCase.student?.email) {
            return res.status(400).json({
                message:
                    'Student email is required.',
            });
        }

        const escapeHtml = (value = '') => {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const resources =
            interventionPlan.resources || [];

        let attachments;
        try {
            attachments = await resolveInterventionAttachments(resources);
        } catch (error) {
            return res.status(400).json({
                message: error.message,
            });
        }

        const attachedFilesHtml =
            attachments.length > 0
                ? `
                    <h3>Attached Files</h3>

                    <ul>
                        ${attachments
                            .map(({ resource }) => {
                                const title =
                                    escapeHtml(
                                        resource.title ||
                                        'Attached resource'
                                    );

                                const description =
                                    resource.description
                                        ? ` — ${escapeHtml(
                                              resource.description
                                          )}`
                                        : '';

                                return `
                                    <li>
                                        ${title}${description}
                                    </li>
                                `;
                            })
                            .join('')}
                    </ul>
                `
                : '';

        const subject =
            'Approved Intervention Plan';

        const html = `
            <p>
                Dear ${escapeHtml(
                    foundCase.student.firstName ||
                    'Student'
                )},
            </p>

            <p>
                Your counselor has approved your intervention plan.
            </p>

            <h3>Goal</h3>
            <p>
                ${escapeHtml(
                    interventionPlan.goal ||
                    'No specific goal was provided.'
                )}
            </p>

            <h3>Plan of Action</h3>
            <p>
                ${escapeHtml(
                    interventionPlan.planOfAction ||
                    'No plan of action was provided.'
                )}
            </p>

            ${
                interventionPlan.timeSpan
                    ? `
                        <h3>Time Span</h3>
                        <p>
                            ${escapeHtml(
                                interventionPlan.timeSpan
                            )}
                        </p>
                    `
                    : ''
            }

            ${attachedFilesHtml}

            <h3>Follow-up</h3>
            <p>
                ${escapeHtml(
                    interventionPlan.followUpPlan ||
                    'Please coordinate with your counselor.'
                )}
            </p>

            <p>
                Regards,<br>
                MSU-IIT Office of Guidance and Counseling
            </p>
        `;

        try {
            await transporter.sendMail({
                from:
                    process.env.EMAIL_USER,

                to:
                    foundCase.student.email,

                subject,

                html,

                attachments:
                    attachments.map(
                        (attachment) => ({
                            filename:
                                attachment.filename,

                            path:
                                attachment.path,
                        })
                    ),
            });
        } catch (error) {
            console.error(
                'Email sending failed:',
                error
            );

            return res.status(500).json({
                message:
                    'Failed to send intervention plan.',
            });
        }

        const sentDate =
            new Date();

        attachments.forEach(
            (attachment) => {
                attachment.resource.isProvidedToStudent =
                    true;

                attachment.resource.providedAt =
                    sentDate;
            }
        );

        interventionPlan.isSentToStudent =
            true;

        interventionPlan.sentAt =
            sentDate;

        interventionPlan.sentBy =
            req.user._id;

        interventionPlan.sentToEmail =
            foundCase.student.email;

        foundCase.updatedBy =
            req.user._id;

        foundCase.actionHistory.push({
            action:
                'Updated',
            remarks:
                attachments.length > 0
                    ? `Approved intervention plan sent to student with ${attachments.length} attached file(s).`
                    : 'Approved intervention plan sent to student without attached files.',

            actionBy:
                req.user._id,

            actionDate:
                sentDate,
        });
        await foundCase.save();
        const updatedCase =
            await Case.findById(
                foundCase._id
            )
                .populate(
                    'student',
                    'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
                )
                .populate(
                    'assignedCounselor',
                    'firstName middleName lastName email role'
                )
                .populate(
                    'interventionPlans.reviewedBy',
                    'firstName middleName lastName email role'
                )
                .populate(
                    'interventionPlans.sentBy',
                    'firstName middleName lastName email role'
                )
                .populate(
                    'updatedBy',
                    'firstName middleName lastName email role'
                );
        return res.status(200).json({
            message:
                attachments.length > 0
                    ? `Approved intervention plan sent successfully with ${attachments.length} attached file(s).`
                    : 'Approved intervention plan sent successfully without attached files.',
            attachmentsSent:
                attachments.length,

            case:
                updatedCase,
        });
    }
);
const getArchivedCases = AsyncHandler(async (req, res) => {
    const { search } = req.query;

    if (req.user.role !== 'Counselor-Admin') {
        return res.status(403).json({
            message: 'Only admins can view archived cases.'
        });
    }
    const query = { isArchived: true };
    if (search) {
        const matchingStudents = await Student.find({
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { middleName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { studentIdNumber: { $regex: search, $options: 'i' } },
                { program: { $regex: search, $options: 'i' } },
                { college: { $regex: search, $options: 'i' } },
                { yearLevel: { $regex: search, $options: 'i' } },
            ]
        }).select('_id');

        const studentIds = matchingStudents.map(
            (student) => student._id
        );
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { caseNumber: searchRegex },
            { caseStatus: searchRegex },
            { 'problemAssessment.mainDomain': searchRegex },
            { student: { $in: studentIds } },
            { clientEntryType: searchRegex },
        ];
    }
    const cases = await Case.find(query)
        .populate(
            'student',
            'firstName middleName lastName email studentIdNumber college program yearLevel'
        )
        .populate(
            'assignedCounselor',
            'firstName middleName lastName email role'
        )
        .populate(
            'archivedBy',
            'firstName middleName lastName email role'
        )
        .sort({ archivedAt: -1 });

    res.status(200).json(cases);
});
const getTemporaryAccessCases =
    AsyncHandler(
        async (req, res) => {
            const now =
                new Date();

            const cases =
                await Case.find({
                    isArchived: false,

                    caseStatus: {
                        $nin: [
                            "Closed",
                            "Terminated",
                        ],
                    },

                    temporaryCounselor: {
                        $elemMatch: {
                            counselor:
                                req.user._id,

                            isActive:
                                true,

                            revokedAt:
                                null,

                            accessUntil: {
                                $gt: now,
                            },
                        },
                    },
                })
                    .populate(
                        "student",
                        `
                            firstName
                            middleName
                            lastName
                            email
                            studentIdNumber
                            college
                            program
                            yearLevel
                            contactNumber
                        `
                    )
                    .populate(
                        "assignedCounselor",
                        `
                            firstName
                            middleName
                            lastName
                            email
                            role
                        `
                    )
                    .populate(
                        "temporaryCounselor.counselor",
                        `
                            firstName
                            middleName
                            lastName
                            email
                            role
                        `
                    )
                    .populate(
                        "temporaryCounselor.grantedBy",
                        `
                            firstName
                            middleName
                            lastName
                            email
                            role
                        `
                    )
                    .populate(
                        "temporaryCounselor.revokedBy",
                        `
                            firstName
                            middleName
                            lastName
                            email
                            role
                        `
                    )
                    .sort({
                        updatedAt: -1,
                    });

            return res
                .status(200)
                .json(cases);
});
const getCaseTimeline = AsyncHandler (async (req, res) => {
    const caseId = req.params.id;
    const foundCase = await Case.findById(caseId)
         .populate(
            'actionHistory.actionBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'actionHistory.fromCounselor',
            'firstName middleName lastName email role'
        )
        .populate(
            'actionHistory.toCounselor',
            'firstName middleName lastName email role'
        )
        .populate(
            'progressNotes.addedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'progressNotes.attendingCounselor',
            'firstName middleName lastName email role'
        );
    
    if (!foundCase){
        return res.status(404).json({ message: 'Case does not exist.'});
    }
    const isAdmin = req.user.role === 'Counselor-Admin';
    const assignedCounselorId =
        foundCase.assignedCounselor?._id ||
        foundCase.assignedCounselor;

    const isAssignedCounselor =
        assignedCounselorId &&
        assignedCounselorId.toString() ===
            req.user._id.toString();

    const hasTemporaryAccess =
        hasActiveTemporaryAccess(
            foundCase,
            req.user._id
        );
    if (foundCase.isArchived && !isAdmin) {
        return res.status(403).json({
            message: 'Only admins can view archived case timelines.'
        });
    }
   if (
        !isAdmin &&
        !isAssignedCounselor &&
        !hasTemporaryAccess
    ) {
        return res.status(403).json({
            message:
                "Not authorized to view this case timeline.",
        });
    }
    const actionEvents = foundCase.actionHistory.map((history) => ({
        type: 'Action',
        title: history.action,
        description: history.remarks || null,
        date: history.actionDate,
        performedBy: history.actionBy || null,
        fromCounselor: history.fromCounselor || null,
        toCounselor: history.toCounselor || null,
    }));
    const progressEvents = foundCase.progressNotes.map((note) => ({
        type: 'Progress Note',
        title: note.progressStatus,
        description: note.progressSummary,
        date: note.noteDate || note.createdAt,
        performedBy: note.addedBy || null,
        attendingCounselor: note.attendingCounselor || null,
        actionTaken: note.actionTaken || null,
        newPlanOfAction: note.newPlanOfAction || null,
        remarks: note.remarks || null,
    }));
    const timeline = [
            ...actionEvents,
            ...progressEvents
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
        caseId: foundCase._id,
        caseNumber: foundCase.caseNumber,
        count: timeline.length,
        timeline
    });
});
const uploadInterventionPlanResources = AsyncHandler(
    async (req, res) => {
        const caseId = req.params.id;
        const planId = req.params.planId;

        const {
            description,
        } = req.body;

        const foundCase = await Case.findById(caseId);

        if (!foundCase) {
            return res.status(404).json({
                message: 'Case not found.',
            });
        }

        if (foundCase.isArchived) {
            return res.status(400).json({
                message:
                    'Resources cannot be uploaded to archived cases.',
            });
        }

        if (
            ['Closed', 'Terminated'].includes(
                foundCase.caseStatus
            )
        ) {
            return res.status(400).json({
                message:
                    'Resources cannot be uploaded to closed or terminated cases.',
            });
        }

        const isAssignedCounselor =
            foundCase.assignedCounselor &&
            foundCase.assignedCounselor.toString() ===
                req.user._id.toString();

        if (!isAssignedCounselor) {
            return res.status(403).json({
                message:
                    'Not authorized to upload intervention-plan resources.',
            });
        }

        if (!planId) {
            return res.status(400).json({
                message:
                    'Intervention plan ID is required.',
            });
        }

        const interventionPlan =
            foundCase.interventionPlans.id(planId);

        if (!interventionPlan) {
            return res.status(404).json({
                message:
                    'Intervention plan does not exist.',
            });
        }

        if (
            ['Completed', 'Cancelled'].includes(
                interventionPlan.status
            )
        ) {
            return res.status(400).json({
                message:
                    'Resources cannot be uploaded to completed or cancelled intervention plans.',
            });
        }

        if (
            !req.files ||
            !Array.isArray(req.files) ||
            req.files.length === 0
        ) {
            return res.status(400).json({
                message:
                    'At least one resource file is required.',
            });
        }

        const determineResourceType = (file) => {
            const extension =
                file.originalname
                    .split('.')
                    .pop()
                    ?.toLowerCase();

            if (extension === 'pdf') {
                return 'PDF';
            }

            if (
                [
                    'doc',
                    'docx',
                    'txt',
                    'rtf',
                    'xls',
                    'xlsx',
                    'ppt',
                    'pptx',
                    'jpg',
                    'jpeg',
                    'png',
                ].includes(extension)
            ) {
                return 'Document';
            }

            return 'Other';
        };

        const uploadedResources =
            req.files.map((file) => {
                return {
                    title:
                        file.originalname,

                    type:
                        determineResourceType(file),

                    url:
                        `/uploads/intervention-resources/${file.filename}`,

                    description:
                        description?.trim() || '',

                    isProvidedToStudent:
                        false,

                    providedAt:
                        null,
                };
            });

        interventionPlan.resources.push(
            ...uploadedResources
        );
        if (
            interventionPlan.approvalStatus ===
            'Approved'
        ) {
            interventionPlan.approvalStatus =
                'Revised';

            interventionPlan.reviewedBy =
                req.user._id;

            interventionPlan.reviewedAt =
                new Date();

            interventionPlan.isSentToStudent =
                false;

            interventionPlan.sentAt =
                null;

            interventionPlan.sentBy =
                null;

            interventionPlan.sentToEmail =
                null;
        }

        foundCase.updatedBy =
            req.user._id;

        foundCase.actionHistory.push({
            action:
                'Updated',

            remarks:
                `${req.files.length} intervention-plan resource file(s) uploaded.`,

            actionBy:
                req.user._id,

            actionDate:
                new Date(),
        });

        await foundCase.save();

        const updatedCase =
            await Case.findById(
                foundCase._id
            )
                .populate(
                    'student',
                    'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
                )
                .populate(
                    'assignedCounselor',
                    'firstName middleName lastName email role'
                )
                .populate(
                    'interventionPlans.reviewedBy',
                    'firstName middleName lastName email role'
                )
                .populate(
                    'updatedBy',
                    'firstName middleName lastName email role'
                );

        return res.status(200).json({
            message:
                `${req.files.length} resource file(s) uploaded successfully.`,

            resources:
                uploadedResources,

            case:
                updatedCase,
        });
    }
);
const populateFollowUpCase = (caseId) => {
    return Case.findById(caseId)
        .populate(
            'student',
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor',
            'firstName middleName lastName email role'
        )
        .populate(
            'followUps.createdBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'followUps.updatedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'followUps.completedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'followUps.cancelledBy',
            'firstName middleName lastName email role'
        );
};

const canManageFollowUps = (
    foundCase,
    user
) => {
    const isAdmin =
        user.role ===
        "Counselor-Admin";

    const assignedCounselorId =
        foundCase.assignedCounselor?._id ||
        foundCase.assignedCounselor;

    const isAssignedCounselor =
        assignedCounselorId &&
        assignedCounselorId.toString() ===
            user._id.toString();

    const hasTemporaryAccess =
        hasActiveTemporaryAccess(
            foundCase,
            user._id
        );

    return (
        isAdmin ||
        isAssignedCounselor ||
        hasTemporaryAccess
    );
};
const createFollowUp = AsyncHandler(async (req, res) => {
    const caseId =
        req.params.id;

    const {
        followUpDate,
        followUpType,
        purpose,
        priority,
        remarks,
    } = req.body;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message:
                'Follow-ups cannot be added to archived cases.',
        });
    }

    if (
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Follow-ups cannot be added to closed or terminated cases.',
        });
    }

    if (
        !canManageFollowUps(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to add follow-ups to this case.',
        });
    }

    const followUpDateValue =
        new Date(followUpDate);

    if (
        !followUpDate ||
        Number.isNaN(
            followUpDateValue.getTime()
        )
    ) {
        return res.status(400).json({
            message:
                'A valid follow-up date and time is required.',
        });
    }

    if (
        followUpDateValue <= new Date()
    ) {
        return res.status(400).json({
            message:
                'Follow-up date and time must be in the future.',
        });
    }

    const allowedTypes = [
        'Counseling Session',
        'Student Check-in',
        'Intervention Review',
        'Referral Follow-up',
        'Parent/Guardian Contact',
        'Academic Monitoring',
        'Other',
    ];

    if (
        !allowedTypes.includes(
            followUpType
        )
    ) {
        return res.status(400).json({
            message:
                'Invalid follow-up type.',
        });
    }

    if (
        !purpose ||
        purpose.trim() === ''
    ) {
        return res.status(400).json({
            message:
                'Follow-up purpose is required.',
        });
    }

    const allowedPriorities = [
        'Low',
        'Moderate',
        'High',
        'Urgent',
    ];

    if (
        priority &&
        !allowedPriorities.includes(
            priority
        )
    ) {
        return res.status(400).json({
            message:
                'Invalid follow-up priority.',
        });
    }

    foundCase.followUps.push({
        followUpDate:
            followUpDateValue,

        followUpType,

        purpose:
            purpose.trim(),

        priority:
            priority || 'Moderate',

        status:
            'Pending',

        remarks:
            remarks?.trim() || '',

        createdBy:
            req.user._id,
    });

    foundCase.caseStatus =
        'For Follow-up';

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Follow-up',

        remarks:
            `Follow-up scheduled for ${followUpDateValue.toLocaleString('en-PH')}.`,

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateFollowUpCase(
            foundCase._id
        );

    return res.status(201).json({
        message:
            'Follow-up created successfully.',

        case:
            updatedCase,
    });
});

const updateFollowUp = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        followUpId,
    } = req.params;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message:
                'Follow-ups for archived cases cannot be edited.',
        });
    }

    if (
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Follow-ups for closed or terminated cases cannot be edited.',
        });
    }

    if (
        !canManageFollowUps(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to edit this follow-up.',
        });
    }

    const followUp =
        foundCase.followUps.id(
            followUpId
        );

    if (!followUp) {
        return res.status(404).json({
            message:
                'Follow-up not found.',
        });
    }

    if (
        followUp.status !== 'Pending'
    ) {
        return res.status(400).json({
            message:
                'Only pending follow-ups can be edited.',
        });
    }

    const {
        followUpDate,
        followUpType,
        purpose,
        priority,
        remarks,
    } = req.body;

    if (
        followUpDate !== undefined
    ) {
        const dateValue =
            new Date(followUpDate);

        if (
            Number.isNaN(
                dateValue.getTime()
            )
        ) {
            return res.status(400).json({
                message:
                    'A valid follow-up date and time is required.',
            });
        }

        if (
            dateValue <= new Date()
        ) {
            return res.status(400).json({
                message:
                    'Follow-up date and time must be in the future.',
            });
        }

        followUp.followUpDate =
            dateValue;
    }

    if (
        followUpType !== undefined
    ) {
        const allowedTypes = [
            'Counseling Session',
            'Student Check-in',
            'Intervention Review',
            'Referral Follow-up',
            'Parent/Guardian Contact',
            'Academic Monitoring',
            'Other',
        ];

        if (
            !allowedTypes.includes(
                followUpType
            )
        ) {
            return res.status(400).json({
                message:
                    'Invalid follow-up type.',
            });
        }

        followUp.followUpType =
            followUpType;
    }

    if (purpose !== undefined) {
        if (
            !purpose ||
            purpose.trim() === ''
        ) {
            return res.status(400).json({
                message:
                    'Follow-up purpose is required.',
            });
        }

        followUp.purpose =
            purpose.trim();
    }

    if (priority !== undefined) {
        const allowedPriorities = [
            'Low',
            'Moderate',
            'High',
            'Urgent',
        ];

        if (
            !allowedPriorities.includes(
                priority
            )
        ) {
            return res.status(400).json({
                message:
                    'Invalid follow-up priority.',
            });
        }

        followUp.priority =
            priority;
    }

    if (remarks !== undefined) {
        followUp.remarks =
            remarks?.trim() || '';
    }

    followUp.updatedBy =
        req.user._id;

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Follow-up',

        remarks:
            'Follow-up details updated.',

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateFollowUpCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Follow-up updated successfully.',

        case:
            updatedCase,
    });
});

const completeFollowUp = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        followUpId,
    } = req.params;

    const {
        completionRemarks,
    } = req.body;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message:
                'Follow-ups for archived cases cannot be completed.',
        });
    }

    if (
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Follow-ups for closed or terminated cases cannot be completed.',
        });
    }

    if (
        !canManageFollowUps(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to complete this follow-up.',
        });
    }

    const followUp =
        foundCase.followUps.id(
            followUpId
        );

    if (!followUp) {
        return res.status(404).json({
            message:
                'Follow-up not found.',
        });
    }

    if (
        followUp.status !== 'Pending'
    ) {
        return res.status(400).json({
            message:
                'Only pending follow-ups can be completed.',
        });
    }

    if (
        !completionRemarks ||
        completionRemarks.trim() === ''
    ) {
        return res.status(400).json({
            message:
                'Completion remarks are required.',
        });
    }

    followUp.status =
        'Completed';

    followUp.completionRemarks =
        completionRemarks.trim();

    followUp.completedAt =
        new Date();

    followUp.completedBy =
        req.user._id;

    followUp.updatedBy =
        req.user._id;

    foundCase.updatedBy =
        req.user._id;

    const hasOtherPendingFollowUps =
        foundCase.followUps.some(
            (item) =>
                item._id.toString() !==
                    followUp._id.toString() &&
                item.status === 'Pending'
        );

    if (
        !hasOtherPendingFollowUps &&
        foundCase.caseStatus ===
            'For Follow-up'
    ) {
        foundCase.caseStatus =
            'In Progress';
    }

    foundCase.actionHistory.push({
        action:
            'Follow-up',

        remarks:
            `Follow-up completed. ${completionRemarks.trim()}`,

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateFollowUpCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Follow-up completed successfully.',

        case:
            updatedCase,
    });
});

const cancelFollowUp = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        followUpId,
    } = req.params;

    const {
        cancellationReason,
    } = req.body;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (foundCase.isArchived) {
        return res.status(400).json({
            message:
                'Follow-ups for archived cases cannot be cancelled.',
        });
    }

    if (
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Follow-ups for closed or terminated cases cannot be cancelled.',
        });
    }

    if (
        !canManageFollowUps(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to cancel this follow-up.',
        });
    }

    const followUp =
        foundCase.followUps.id(
            followUpId
        );

    if (!followUp) {
        return res.status(404).json({
            message:
                'Follow-up not found.',
        });
    }

    if (
        followUp.status !== 'Pending'
    ) {
        return res.status(400).json({
            message:
                'Only pending follow-ups can be cancelled.',
        });
    }

    followUp.status =
        'Cancelled';

    followUp.cancellationReason =
        cancellationReason?.trim() ||
        'Cancelled by counselor.';

    followUp.cancelledAt =
        new Date();

    followUp.cancelledBy =
        req.user._id;

    followUp.updatedBy =
        req.user._id;

    foundCase.updatedBy =
        req.user._id;

    const hasOtherPendingFollowUps =
        foundCase.followUps.some(
            (item) =>
                item._id.toString() !==
                    followUp._id.toString() &&
                item.status === 'Pending'
        );

    if (
        !hasOtherPendingFollowUps &&
        foundCase.caseStatus ===
            'For Follow-up'
    ) {
        foundCase.caseStatus =
            'In Progress';
    }

    foundCase.actionHistory.push({
        action:
            'Follow-up',

        remarks:
            `Follow-up cancelled. Reason: ${followUp.cancellationReason}`,

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateFollowUpCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Follow-up cancelled successfully.',

        case:
            updatedCase,
    });
});
const populateRecommendationCase = (caseId) => {
    return Case.findById(caseId)
        .populate(
            'student',
            'firstName middleName lastName email studentIdNumber college program yearLevel contactNumber'
        )
        .populate(
            'assignedCounselor',
            'firstName middleName lastName email role'
        )
        .populate(
            'llmRecommendations.generatedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'llmRecommendations.reviewedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'interventionPlans.reviewedBy',
            'firstName middleName lastName email role'
        )
        .populate(
            'updatedBy',
            'firstName middleName lastName email role'
        );
};

const canManageRecommendations = (foundCase, user) => {
    const userId = String(user._id);
    const creatorId = foundCase.createdBy?._id || foundCase.createdBy;
    const assignedId = foundCase.assignedCounselor?._id || foundCase.assignedCounselor;
    return user.role === 'Counselor-Admin'
        ? Boolean(creatorId) && String(creatorId) === userId
        : Boolean(assignedId) && String(assignedId) === userId;
};

const collectTextValues = (value) => {
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === "string") {
        const cleaned = value.trim();

        return cleaned
            ? [cleaned]
            : [];
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return [String(value)];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) =>
            collectTextValues(item)
        );
    }

    if (typeof value === "object") {
        return Object.entries(value).flatMap(([key, item]) => {
            if (['_id', '__v'].includes(key)) return [];
            const label = key.replace(/([a-z])([A-Z])/g, '$1 $2');
            return collectTextValues(item).map(text => `${label}: ${text}`);
        });
    }

    return [];
};

const buildCaseText = (value) => {
    return collectTextValues(value)
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
};

const buildRagCaseData = (caseDocument) => {
    const caseObject =
        typeof caseDocument.toObject === "function"
            ? caseDocument.toObject()
            : caseDocument;

    return {
        caseNumber:
            caseObject.caseNumber || "",

        mentalStatus: buildCaseText(caseObject.mentalStatus),

        currentPresentation:
            buildCaseText(
                caseObject.currentPresentation
            ),

        problemAssessment:
            buildCaseText(
                caseObject.problemAssessment
            ),

        caseFormulationFactors:
            buildCaseText(
                caseObject.caseFormulationFactors
            ),

        backgroundAndPsychosocialHistory:
            buildCaseText(
                caseObject.backgroundAndPsychosocialHistory
            ),

        caseFormulation:
            buildCaseText(
                caseObject.caseFormulation
            ),

        referralInformation:
            buildCaseText(
                caseObject.referralInformation
            ),
    };
};

const buildRagRetrievalQuery = (caseData) => {
    const sections = [
        caseData.mentalStatus,
        caseData.currentPresentation,
        caseData.problemAssessment,
        caseData.caseFormulationFactors,
        caseData.backgroundAndPsychosocialHistory,
        caseData.caseFormulation,
        caseData.referralInformation,
    ].filter(Boolean);

    return sections
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
};

const generateLLMRecommendation = AsyncHandler(async (req, res) => {
    const caseId = req.params.id;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                "Case not found.",
        });
    }

    if (
        foundCase.isArchived ||
        ["Closed", "Terminated"].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                "Recommendations can only be generated for active cases.",
        });
    }

    if (
        !canManageRecommendations(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                "Not authorized to generate recommendations for this case.",
        });
    }

    /*
     * Prepare the actual case information
     * for the RAG recommendation service.
     */
    const ragCaseData =
        buildRagCaseData(
            foundCase
        );

    const retrievalQuery =
        buildRagRetrievalQuery(
            ragCaseData
        );

    if (!retrievalQuery) {
        return res.status(400).json({
            success: false,
            message:
                "The case does not contain enough information to generate an intervention recommendation.",
        });
    }

    /*
     * Generate recommendations using:
     *
     * Actual case
     * -> Atlas Vector Search
     * -> Knowledge Base
     * -> Gemma
     */
    const ragResult =
        await generateInterventionRecommendations(
            ragCaseData,
            {
                retrievalQuery,

                limit:
                    5,

                numCandidates:
                    50,

                temperature:
                    0.2,

                numPredict:
                    3000,
            }
        );

    /*
     * Stop if the Knowledge Base does not
     * contain enough supporting material.
     */
    if (
        !ragResult ||
        ragResult.status ===
            "insufficient_reference_material"
    ) {
        return res.status(422).json({
            success: false,
            message:
                "The Knowledge Base does not contain enough relevant reference material for this case.",
        });
    }

    const generatedRecommendations =
        Array.isArray(
            ragResult.recommendations
        )
            ? ragResult.recommendations
            : [];

    if (
        generatedRecommendations.length ===
        0
    ) {
        return res.status(422).json({
            success: false,
            message:
                "No intervention recommendations were generated for this case.",
        });
    }

    /*
     * -------------------------------------------------
     * SUGGESTED INTERVENTIONS
     * -------------------------------------------------
     *
     * Each intervention generated by the RAG service
     * becomes one suggested intervention in the
     * existing My.GUIDE recommendation structure.
     */
    const suggestedInterventions =
        generatedRecommendations
            .map(
                (recommendation) =>
                    recommendation
                        ?.intervention
                        ?.trim()
            )
            .filter(Boolean);

    /*
     * -------------------------------------------------
     * PLAN OF ACTION
     * -------------------------------------------------
     *
     * Combine all counselor actions from the generated
     * recommendations into one readable plan.
     */
    const counselorActions =
        generatedRecommendations.flatMap(
            (recommendation) =>
                Array.isArray(
                    recommendation
                        ?.counselorActions
                )
                    ? recommendation
                          .counselorActions
                          .map(
                              (
                                  actionItem
                              ) =>
                                  actionItem
                                      ?.action
                                      ?.trim()
                          )
                          .filter(
                              Boolean
                          )
                    : []
        );

    const planOfAction =
        counselorActions.length > 0
            ? counselorActions
                  .map(
                      (
                          action,
                          index
                      ) =>
                          `${index + 1}. ${action}`
                  )
                  .join("\n")
            : suggestedInterventions
                  .map(
                      (
                          intervention,
                          index
                      ) =>
                          `${index + 1}. ${intervention}`
                  )
                  .join("\n");

    /*
     * -------------------------------------------------
     * RATIONALE
     * -------------------------------------------------
     *
     * Preserve the rationale associated with each
     * generated intervention.
     */
    const rationale =
        generatedRecommendations
            .map(
                (
                    recommendation,
                    index
                ) => {
                    const intervention =
                        recommendation
                            ?.intervention
                            ?.trim();

                    const reason =
                        recommendation
                            ?.rationale
                            ?.trim();

                    if (!reason) {
                        return null;
                    }

                    if (intervention) {
                        return `${index + 1}. ${intervention}\n${reason}`;
                    }

                    return `${index + 1}. ${reason}`;
                }
            )
            .filter(Boolean)
            .join("\n\n");

/*
 * -------------------------------------------------
 * RETRIEVED SOURCES
 * -------------------------------------------------
 *
 * Store the references returned by the RAG
 * service so the counselor can see which
 * Knowledge Base materials supported the result.
 */
const retrievedReferences =
    Array.isArray(
        ragResult.retrievedReferences
    )
        ? ragResult.retrievedReferences
        : [];

const retrievedSources =
    retrievedReferences.map(
        (reference) => {
            const title =
                reference.title ||
                reference.source ||
                "Knowledge Base Resource";

            const sourceType =
                reference.resourceType ||
                "reference";

            const referenceParts = [];

            if (
                reference.source &&
                reference.source !== title
            ) {
                referenceParts.push(
                    reference.source
                );
            }

            if (reference.pageNumber) {
                referenceParts.push(
                    `Page ${reference.pageNumber}`
                );
            }

            if (reference.referenceNumber) {
                referenceParts.push(
                    `Reference ${reference.referenceNumber}`
                );
            }

            return {
                title,
                sourceType,
                reference:
                    referenceParts.join(
                        " • "
                    ) || title,
            };
        }
    );

/*
 * -------------------------------------------------
 * SUPPORTING RESOURCES
 * -------------------------------------------------
 *
 * The RAG service may select a practical resource
 * such as a worksheet, handout, activity,
 * exercise, or template.
 *
 * Convert the resolved supportingResource metadata
 * into the same resources[] structure already used
 * by My.GUIDE for recommendation resources.
 *
 * IMPORTANT:
 * - Do not invent PDF paths.
 * - Only use the real relativeFilePath returned by
 *   the Knowledge Base / RAG service.
 * - Do not turn ordinary evidence references into
 *   downloadable resources.
 */
const concernSummary = (
    ragCaseData.currentPresentation ||
    ragCaseData.problemAssessment ||
    "Intervention recommendation based on the documented case information."
).replace(/^\s*narrative\s*description\s*:\s*/i, "");

/*
 * -------------------------------------------------
 * GOAL
 * -------------------------------------------------
 *
 * The current RAG response does not generate a
 * separate goal field. Build a neutral goal from
 * the generated interventions instead of
 * inventing unsupported case details.
 */
const goal =
    suggestedInterventions.length > 0
        ? `Support the student through appropriate interventions related to the documented concerns, including ${suggestedInterventions
              .map((item) =>
                  item.replace(
                      /[.!]+$/,
                      ""
                  )
              )
              .join(", ")}.`
        : "Support the student in addressing the documented concerns through appropriate intervention strategies.";

/*
 * -------------------------------------------------
 * SUPPORTING RESOURCES
 * -------------------------------------------------
 *
 * Automatically attach Knowledge Base PDFs selected
 * by the RAG service as supporting resources.
 *
 * The same PDF may support multiple interventions,
 * so duplicate resource IDs are removed.
 */
const recommendationResources = [];

const seenResourceIds =
    new Set();

for (
    const generatedRecommendation
    of generatedRecommendations
) {
    const supportingResource =
        generatedRecommendation
            ?.supportingResource;

    if (
        !supportingResource ||
        !supportingResource.resourceId ||
        !['worksheet', 'handout', 'activity', 'exercise', 'template'].includes(supportingResource.resourceType)
    ) {
        continue;
    }

    const resourceId =
        String(
            supportingResource.resourceId
        ).trim();

    if (
        seenResourceIds.has(
            resourceId
        )
    ) {
        continue;
    }

    seenResourceIds.add(
        resourceId
    );

    recommendationResources.push({
        title:
            supportingResource.title ||
            supportingResource.source ||
            supportingResource.originalFilename ||
            "Supporting Resource",

        type:
            "PDF",

        url:
            `/api/knowledge-base/${resourceId}/pdf`,

        description:
            [
                supportingResource.resourceType,
                supportingResource.topic,
            ]
                .filter(Boolean)
                .join(" • "),

        isProvidedToStudent:
            false,

        providedAt:
            null,
    });
}

/*
 * -------------------------------------------------
 * CREATE ONE COUNSELOR-REVIEWABLE DRAFT
 * -------------------------------------------------
 *
 * The RAG service may produce several intervention
 * suggestions, but My.GUIDE stores them together
 * as one recommendation draft for counselor review.
 */
const recommendation = {
    generationMode:
        "LLM-RAG",

    status:
        "Draft",

    concernSummary,

    goal,

    suggestedInterventions,

    planOfAction,

    /*
     * The current RAG output does not provide
     * evidence-supported duration or follow-up
     * timing, so leave these blank for counselor
     * review instead of inventing values.
     */
    timeSpan:
        "",

    followUpPlan:
        "",

    rationale,

    retrievedSources,

    /*
     * These are the actual practical resources
     * selected by RAG and resolved to real stored
     * Knowledge Base PDF paths.
     */
    resources:
        recommendationResources,

    generatedBy:
        req.user._id,
};
    /*
     * Save the recommendation draft.
     */
    foundCase.llmRecommendations.push(
        recommendation
    );

    foundCase.updatedBy =
        req.user._id;

    /*
     * Record the generation in the case history.
     */
    foundCase.actionHistory.push({
        action:
            "Updated",

        remarks:
            "LLM-RAG intervention recommendation generated for counselor review.",

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    /*
     * Populate the case again so the frontend
     * receives the complete recommendation data.
     */
    const updatedCase =
        await populateRecommendationCase(
            foundCase._id
        );

    return res.status(201).json({
        success:
            true,

        message:
            "Recommendation draft generated successfully.",

        generationMode:
            "LLM-RAG",

        case:
            updatedCase,
    });
});

const reviseLLMRecommendation = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        recommendationId,
    } = req.params;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (
        foundCase.isArchived ||
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Recommendations for inactive cases cannot be revised.',
        });
    }

    if (
        !canManageRecommendations(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to revise this recommendation.',
        });
    }

    const recommendation =
        foundCase.llmRecommendations.id(
            recommendationId
        );

    if (!recommendation) {
        return res.status(404).json({
            message:
                'Recommendation not found.',
        });
    }

    if (
        ['Accepted', 'Rejected'].includes(
            recommendation.status
        )
    ) {
        return res.status(400).json({
            message:
                'Accepted or rejected recommendations cannot be revised.',
        });
    }

    const allowedFields = [
        'concernSummary',
        'goal',
        'suggestedInterventions',
        'planOfAction',
        'timeSpan',
        'followUpPlan',
        'rationale',
        'counselorRemarks',
        "resources",
    ];

    for (const field of allowedFields) {
        if (
            req.body[field] !== undefined
        ) {
            recommendation[field] =
                req.body[field];
        }
    }

    if (
        !recommendation.concernSummary?.trim() ||
        !recommendation.goal?.trim() ||
        !recommendation.planOfAction?.trim()
    ) {
        return res.status(400).json({
            message:
                'Concern summary, goal, and plan of action are required.',
        });
    }

    recommendation.suggestedInterventions =
        (
            recommendation.suggestedInterventions ||
            []
        )
            .map((item) => item.trim())
            .filter(Boolean);

    recommendation.status =
        'Revised';

    recommendation.reviewedBy =
        req.user._id;

    recommendation.reviewedAt =
        new Date();

    recommendation.rejectionReason =
        null;

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Updated',

        remarks:
            'LLM recommendation revised by counselor.',

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateRecommendationCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Recommendation revised successfully.',

        case:
            updatedCase,
    });
});

const acceptLLMRecommendation = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        recommendationId,
    } = req.params;

    const {
        counselorRemarks,
    } = req.body;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (
        foundCase.isArchived ||
        ['Closed', 'Terminated'].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                'Recommendations for inactive cases cannot be accepted.',
        });
    }

    if (
        !canManageRecommendations(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to accept this recommendation.',
        });
    }

    const recommendation =
        foundCase.llmRecommendations.id(
            recommendationId
        );

    if (!recommendation) {
        return res.status(404).json({
            message:
                'Recommendation not found.',
        });
    }

    if (
        !['Draft', 'Revised'].includes(
            recommendation.status
        )
    ) {
        return res.status(400).json({
            message:
                'Only draft or revised recommendations can be accepted.',
        });
    }

    if (
        !recommendation.goal?.trim() ||
        !recommendation.planOfAction?.trim()
    ) {
        return res.status(400).json({
            message:
                'The recommendation is incomplete and cannot be converted into an intervention plan.',
        });
    }

    foundCase.interventionPlans.push({
        problem:
            recommendation.concernSummary,

        goal:
            recommendation.goal,

        planOfAction:
            recommendation.planOfAction,

        timeSpan:
            recommendation.timeSpan,

        followUpPlan:
            recommendation.followUpPlan,

        remarks:
            counselorRemarks?.trim() ||
            recommendation.counselorRemarks ||
            'Created from a counselor-reviewed LLM recommendation.',

         resources:
            (recommendation.resources || []).map(
                (resource) => ({
                    title:
                        resource.title,

                    type:
                        resource.type,

                    url:
                        resource.url,

                    description:
                        resource.description,

                    isProvidedToStudent:
                        false,

                    providedAt:
                        null,
                })
            ),

        status:
            'Planned',

        approvalStatus:
            'Pending Review',
    });

    const createdPlan =
        foundCase.interventionPlans[
            foundCase.interventionPlans.length -
                1
        ];

    recommendation.status =
        'Accepted';

    recommendation.counselorRemarks =
        counselorRemarks?.trim() ||
        recommendation.counselorRemarks ||
        '';

    recommendation.reviewedBy =
        req.user._id;

    recommendation.reviewedAt =
        new Date();

    recommendation.convertedPlanId =
        createdPlan._id;

    recommendation.rejectionReason =
        null;

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Updated',

        remarks:
            'LLM recommendation accepted and converted into an intervention-plan draft.',

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateRecommendationCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Recommendation accepted and converted into an intervention-plan draft.',

        interventionPlanId:
            createdPlan._id,

        case:
            updatedCase,
    });
});

const rejectLLMRecommendation = AsyncHandler(async (req, res) => {
    const {
        id: caseId,
        recommendationId,
    } = req.params;

    const {
        rejectionReason,
    } = req.body;

    const foundCase =
        await Case.findById(caseId);

    if (!foundCase) {
        return res.status(404).json({
            message:
                'Case not found.',
        });
    }

    if (
        !canManageRecommendations(
            foundCase,
            req.user
        )
    ) {
        return res.status(403).json({
            message:
                'Not authorized to reject this recommendation.',
        });
    }

    const recommendation =
        foundCase.llmRecommendations.id(
            recommendationId
        );

    if (!recommendation) {
        return res.status(404).json({
            message:
                'Recommendation not found.',
        });
    }

    if (
        !['Draft', 'Revised'].includes(
            recommendation.status
        )
    ) {
        return res.status(400).json({
            message:
                'Only draft or revised recommendations can be rejected.',
        });
    }

    if (
        !rejectionReason ||
        rejectionReason.trim() === ''
    ) {
        return res.status(400).json({
            message:
                'Rejection reason is required.',
        });
    }

    recommendation.status =
        'Rejected';

    recommendation.rejectionReason =
        rejectionReason.trim();

    recommendation.reviewedBy =
        req.user._id;

    recommendation.reviewedAt =
        new Date();

    foundCase.updatedBy =
        req.user._id;

    foundCase.actionHistory.push({
        action:
            'Updated',

        remarks:
            `LLM recommendation rejected. Reason: ${rejectionReason.trim()}`,

        actionBy:
            req.user._id,

        actionDate:
            new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await populateRecommendationCase(
            foundCase._id
        );

    return res.status(200).json({
        message:
            'Recommendation rejected successfully.',

        case:
            updatedCase,
    });
});

const uploadLLMRecommendationResources = AsyncHandler(
    async (req, res) => {
        const {
            id: caseId,
            recommendationId,
        } = req.params;

        const files =
            Array.isArray(req.files)
                ? req.files
                : [];

        const {
            title,
            description,
        } = req.body;

        if (files.length === 0) {
            return res.status(400).json({
                message:
                    'At least one recommendation resource file is required.',
            });
        }

        const foundCase =
            await Case.findById(caseId);

        if (!foundCase) {
            return res.status(404).json({
                message:
                    'Case not found.',
            });
        }

        if (
            foundCase.isArchived ||
            ['Closed', 'Terminated'].includes(
                foundCase.caseStatus
            )
        ) {
            return res.status(400).json({
                message:
                    'Resources can only be added to recommendations for active cases.',
            });
        }

        if (
            !canManageRecommendations(
                foundCase,
                req.user
            )
        ) {
            return res.status(403).json({
                message:
                    'Not authorized to upload recommendation resources.',
            });
        }

        const recommendation =
            foundCase.llmRecommendations.id(
                recommendationId
            );

        if (!recommendation) {
            return res.status(404).json({
                message:
                    'Recommendation not found.',
            });
        }

        if (
            ['Accepted', 'Rejected'].includes(
                recommendation.status
            )
        ) {
            return res.status(400).json({
                message:
                    'Resources cannot be added after a recommendation has been accepted or rejected.',
            });
        }

        const getResourceType = (file) => {
            if (
                file.mimetype ===
                'application/pdf'
            ) {
                return 'PDF';
            }

            if (
                file.mimetype?.startsWith(
                    'image/'
                )
            ) {
                return 'Image';
            }

            if (
                file.mimetype?.includes(
                    'word'
                ) ||
                file.mimetype?.includes(
                    'excel'
                ) ||
                file.mimetype?.includes(
                    'spreadsheet'
                ) ||
                file.mimetype?.includes(
                    'powerpoint'
                ) ||
                file.mimetype ===
                    'text/plain'
            ) {
                return 'Document';
            }

            return 'Other';
        };

        const uploadedResources =
            files.map((file) => ({
                title:
                    files.length === 1 &&
                    title?.trim()
                        ? title.trim()
                        : file.originalname,

                type:
                    getResourceType(file),

                url:
                    `/uploads/intervention-resources/${file.filename}`,

                description:
                    description?.trim() || '',

                isProvidedToStudent:
                    false,

                providedAt:
                    null,
            }));

        recommendation.resources.push(
            ...uploadedResources
        );

        recommendation.status =
            'Revised';

        recommendation.reviewedBy =
            req.user._id;

        recommendation.reviewedAt =
            new Date();

        foundCase.updatedBy =
            req.user._id;

        foundCase.actionHistory.push({
            action:
                'Updated',

            remarks:
                `${files.length} recommendation resource file${
                    files.length === 1
                        ? ''
                        : 's'
                } uploaded.`,

            actionBy:
                req.user._id,

            actionDate:
                new Date(),
        });

        await foundCase.save();

        const updatedCase =
            await populateRecommendationCase(
                foundCase._id
            );

        return res.status(200).json({
            message:
                `${files.length} recommendation resource file${
                    files.length === 1
                        ? ''
                        : 's'
                } uploaded successfully.`,

            resources:
                uploadedResources,

            case:
                updatedCase,
        });
    }
);

const sendFollowUpReminder = AsyncHandler(async (req, res) => {
    const { id, followUpId } = req.params;

    const foundCase = await Case.findById(id)
        .populate(
            "student",
            "firstName middleName lastName email studentIdNumber"
        )
        .populate(
            "assignedCounselor",
            "firstName middleName lastName email role"
        );

    if (!foundCase) {
        return res.status(404).json({
            message: "Case not found.",
        });
    }

    if (foundCase.isArchived) {
        return res.status(403).json({
            message:
                "Reminders cannot be sent for archived cases.",
        });
    }

    if (
        ["Closed", "Terminated"].includes(
            foundCase.caseStatus
        )
    ) {
        return res.status(400).json({
            message:
                "Reminders cannot be sent for closed or terminated cases.",
        });
    }

    const isAdmin =
        req.user.role === "Counselor-Admin";

    const isAssignedCounselor =
        foundCase.assignedCounselor &&
        foundCase.assignedCounselor._id
            .toString() ===
            req.user._id.toString();
    const hasTemporaryAccess =
        hasActiveTemporaryAccess(
            foundCase,
            req.user._id
        );

   if (
        !isAdmin &&
        !isAssignedCounselor &&
        !hasTemporaryAccess
    ){
        return res.status(403).json({
            message:
                "Not authorized to send a reminder for this follow-up.",
        });
    }

    const followUp =
        foundCase.followUps.id(followUpId);

    if (!followUp) {
        return res.status(404).json({
            message: "Follow-up not found.",
        });
    }

    if (followUp.status !== "Pending") {
        return res.status(400).json({
            message:
                "Only pending follow-ups can receive reminders.",
        });
    }

    const studentEmail =
        foundCase.student?.email?.trim();

    if (!studentEmail) {
        return res.status(400).json({
            message:
                "The student does not have an email address on record.",
        });
    }

    const studentName = [
        foundCase.student.firstName,
    ]
        .filter(Boolean)
        .join(" ");

    const counselorName = [
        req.user.firstName,
        req.user.lastName,
    ]
        .filter(Boolean)
        .join(" ");

    const formattedDate =
        new Intl.DateTimeFormat("en-PH", {
            dateStyle: "full",
            timeStyle: "short",
        }).format(
            new Date(followUp.followUpDate)
        );

    await transporter.sendMail({
        to: studentEmail,

        subject:
            "My.GUIDE Counseling Follow-up Reminder",

        html: `
            <p>Hello ${studentName},</p>

            <p>
                This is a reminder regarding your scheduled counseling follow-up.
            </p>

            <p>
                <strong>Follow-up type:</strong>
                ${followUp.followUpType}
            </p>

            <p>
                <strong>Date and time:</strong>
                ${formattedDate}
            </p>

            <p>
                <strong>Purpose:</strong>
                ${followUp.purpose}
            </p>

            <p>
                Please contact the Office of Guidance and Counseling
                if you need clarification or are unable to attend.
            </p>

            <p>
                Counselor: ${counselorName || "Assigned counselor"}
            </p>

        `,
    });

    followUp.reminderSentAt = new Date();
    followUp.reminderSentBy = req.user._id;
    followUp.reminderSentTo = studentEmail;
    followUp.reminderSendCount =
        (followUp.reminderSendCount || 0) + 1;

    foundCase.updatedBy = req.user._id;

    foundCase.actionHistory.push({
        action: "Follow-up",
        remarks:
            `Follow-up reminder sent to ${studentEmail}.`,
        actionBy: req.user._id,
        actionDate: new Date(),
    });

    await foundCase.save();

    const updatedCase =
        await Case.findById(foundCase._id)
            .populate(
                "student",
                `
                    firstName
                    middleName
                    lastName
                    email
                    studentIdNumber
                    college
                    program
                    yearLevel
                `
            )
            .populate(
                "assignedCounselor",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            )
            .populate(
                "followUps.createdBy",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            )
            .populate(
                "followUps.reminderSentBy",
                `
                    firstName
                    middleName
                    lastName
                    email
                    role
                `
            );

    res.status(200).json({
        message:
            `Follow-up reminder sent to ${studentEmail}.`,
        case: updatedCase,
    });
});

module.exports = {
    getStudentActiveCase,
    getAllCases,
    getCaseById,
    getMyCases,
    createCase,
    updateCase,
    updateCaseStatus,
    assignCounselor,
    addProgressNotes,
    archiveCase,
    getArchivedCases,
    restoreCase,
    approveInterventionPlan,
    reviseInterventionPlan,
    rejectInterventionPlan,
    sendApprovedInterventionPlan,
    getCaseTimeline,
    uploadInterventionPlanResources,

    createFollowUp,
    updateFollowUp,
    completeFollowUp,
    cancelFollowUp,
    sendFollowUpReminder,

    grantTemporaryAccess,
    revokeTemporaryAccess,
    getTemporaryAccessCases,


    generateLLMRecommendation,
    reviseLLMRecommendation,
    acceptLLMRecommendation,
    rejectLLMRecommendation,
    uploadLLMRecommendationResources,
    
};