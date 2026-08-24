-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `avatarColor` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'team_member',
    `teamId` VARCHAR(191) NULL,

    INDEX `Membership_eventId_idx`(`eventId`),
    UNIQUE INDEX `Membership_userId_eventId_key`(`userId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'wedding',
    `category` VARCHAR(191) NOT NULL DEFAULT 'individual',
    `description` VARCHAR(2000) NOT NULL DEFAULT '',
    `hostNames` VARCHAR(255) NOT NULL DEFAULT '',
    `coverUrl` TEXT NULL,
    `logoUrl` TEXT NULL,
    `location` VARCHAR(500) NOT NULL DEFAULT '',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Pacific/Auckland',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NZD',
    `locale` VARCHAR(191) NOT NULL DEFAULT 'en-NZ',
    `privacy` VARCHAR(191) NOT NULL DEFAULT 'unlisted',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `totalBudget` DOUBLE NOT NULL DEFAULT 0,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Event_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Phase` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL DEFAULT '',
    `description` VARCHAR(2000) NOT NULL DEFAULT '',
    `position` INTEGER NOT NULL DEFAULT 0,
    `date` DATETIME(3) NULL,
    `startTime` VARCHAR(191) NOT NULL DEFAULT '',
    `endTime` VARCHAR(191) NOT NULL DEFAULT '',
    `venue` VARCHAR(191) NOT NULL DEFAULT '',
    `address` VARCHAR(500) NOT NULL DEFAULT '',
    `mapUrl` VARCHAR(1000) NOT NULL DEFAULT '',
    `dressCode` VARCHAR(191) NOT NULL DEFAULT '',
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `requiresRsvp` BOOLEAN NOT NULL DEFAULT true,
    `requiresSeating` BOOLEAN NOT NULL DEFAULT false,
    `requiresMenu` BOOLEAN NOT NULL DEFAULT false,
    `requiresTicket` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Phase_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestGroup` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `colour` VARCHAR(191) NOT NULL DEFAULT '#ffffff',

    INDEX `GuestGroup_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guest` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `organisation` VARCHAR(255) NOT NULL DEFAULT '',
    `relationship` VARCHAR(191) NOT NULL DEFAULT '',
    `isVip` BOOLEAN NOT NULL DEFAULT false,
    `isChild` BOOLEAN NOT NULL DEFAULT false,
    `plusOnes` INTEGER NOT NULL DEFAULT 0,
    `dietary` VARCHAR(191) NOT NULL DEFAULT '',
    `allergies` VARCHAR(500) NOT NULL DEFAULT '',
    `accessibility` VARCHAR(500) NOT NULL DEFAULT '',
    `notes` VARCHAR(2000) NOT NULL DEFAULT '',
    `accessToken` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Guest_accessToken_key`(`accessToken`),
    INDEX `Guest_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhaseInvite` (
    `id` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'invited',
    `partySize` INTEGER NOT NULL DEFAULT 1,
    `adults` INTEGER NOT NULL DEFAULT 1,
    `children` INTEGER NOT NULL DEFAULT 0,
    `message` VARCHAR(1000) NOT NULL DEFAULT '',
    `transportNeeded` BOOLEAN NOT NULL DEFAULT false,
    `accommodationNeeded` BOOLEAN NOT NULL DEFAULT false,
    `respondedAt` DATETIME(3) NULL,
    `viewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhaseInvite_phaseId_idx`(`phaseId`),
    UNIQUE INDEX `PhaseInvite_guestId_phaseId_key`(`guestId`, `phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `colour` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `brief` VARCHAR(1000) NOT NULL DEFAULT '',

    INDEX `Team_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `teamId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(2000) NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `dueDate` DATETIME(3) NULL,
    `cost` DOUBLE NOT NULL DEFAULT 0,
    `dependsOnId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Task_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskComment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetLine` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `budgeted` DOUBLE NOT NULL DEFAULT 0,
    `committed` DOUBLE NOT NULL DEFAULT 0,
    `notes` VARCHAR(2000) NOT NULL DEFAULT '',

    INDEX `BudgetLine_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `teamId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `budgetLineId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `description` VARCHAR(2000) NOT NULL DEFAULT '',
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NZD',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `approval` VARCHAR(191) NOT NULL DEFAULT 'submitted',
    `payment` VARCHAR(191) NOT NULL DEFAULT 'unpaid',
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `attachmentUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Invoice_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'other',
    `contact` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` VARCHAR(2000) NOT NULL DEFAULT '',
    `rating` INTEGER NOT NULL DEFAULT 0,

    INDEX `Vendor_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gift` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NULL,
    `fromName` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NZD',
    `message` VARCHAR(1000) NOT NULL DEFAULT '',
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `showAmount` BOOLEAN NOT NULL DEFAULT false,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `providerRef` VARCHAR(255) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Gift_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleItem` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(2000) NOT NULL DEFAULT '',
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL DEFAULT '',
    `location` VARCHAR(191) NOT NULL DEFAULT '',
    `ownerTeam` VARCHAR(191) NOT NULL DEFAULT '',
    `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `ScheduleItem_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuCourse` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `choose` INTEGER NOT NULL DEFAULT 1,

    INDEX `MenuCourse_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuItem` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(2000) NOT NULL DEFAULT '',
    `dietary` VARCHAR(191) NOT NULL DEFAULT '',
    `allergens` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuSelection` (
    `id` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MenuSelection_guestId_itemId_key`(`guestId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatingTable` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `capacity` INTEGER NOT NULL DEFAULT 10,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `x` DOUBLE NOT NULL DEFAULT 0,
    `y` DOUBLE NOT NULL DEFAULT 0,

    INDEX `SeatingTable_phaseId_idx`(`phaseId`),
    UNIQUE INDEX `SeatingTable_phaseId_number_key`(`phaseId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `tableId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `seatNo` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `SeatAssignment_tableId_guestId_key`(`tableId`, `guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeatingRule` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `guestIds` TEXT NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,

    INDEX `SeatingRule_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Poll` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `question` TEXT NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'single',
    `audience` VARCHAR(191) NOT NULL DEFAULT 'guests',
    `anonymous` BOOLEAN NOT NULL DEFAULT true,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'public',
    `closesAt` DATETIME(3) NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Poll_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PollOption` (
    `id` VARCHAR(191) NOT NULL,
    `pollId` VARCHAR(191) NOT NULL,
    `label` TEXT NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PollVote` (
    `id` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PollVote_optionId_guestId_key`(`optionId`, `guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `audience` VARCHAR(191) NOT NULL DEFAULT 'all_guests',
    `channels` VARCHAR(191) NOT NULL DEFAULT 'in_app',
    `urgent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Announcement_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Album` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `coverUrl` TEXT NULL,
    `guestUploads` BOOLEAN NOT NULL DEFAULT true,
    `downloads` VARCHAR(191) NOT NULL DEFAULT 'guests',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Album_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaItem` (
    `id` VARCHAR(191) NOT NULL,
    `albumId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NULL,
    `url` TEXT NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'photo',
    `caption` VARCHAR(500) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MediaItem_albumId_idx`(`albumId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventDocument` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'organisers',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventDocument_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketType` (
    `id` VARCHAR(191) NOT NULL,
    `phaseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'NZD',
    `capacity` INTEGER NOT NULL DEFAULT 0,
    `perks` VARCHAR(500) NOT NULL DEFAULT '',
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `TicketType_phaseId_idx`(`phaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `ticketTypeId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'issued',
    `seatLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `checkedInAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Ticket_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(2000) NOT NULL DEFAULT '',
    `severity` VARCHAR(191) NOT NULL DEFAULT 'info',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Phase` ADD CONSTRAINT `Phase_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestGroup` ADD CONSTRAINT `GuestGroup_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guest` ADD CONSTRAINT `Guest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guest` ADD CONSTRAINT `Guest_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `GuestGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhaseInvite` ADD CONSTRAINT `PhaseInvite_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhaseInvite` ADD CONSTRAINT `PhaseInvite_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_dependsOnId_fkey` FOREIGN KEY (`dependsOnId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetLine` ADD CONSTRAINT `BudgetLine_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetLine` ADD CONSTRAINT `BudgetLine_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_budgetLineId_fkey` FOREIGN KEY (`budgetLineId`) REFERENCES `BudgetLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Gift` ADD CONSTRAINT `Gift_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Gift` ADD CONSTRAINT `Gift_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleItem` ADD CONSTRAINT `ScheduleItem_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuCourse` ADD CONSTRAINT `MenuCourse_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuItem` ADD CONSTRAINT `MenuItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `MenuCourse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuSelection` ADD CONSTRAINT `MenuSelection_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuSelection` ADD CONSTRAINT `MenuSelection_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `MenuItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatingTable` ADD CONSTRAINT `SeatingTable_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatAssignment` ADD CONSTRAINT `SeatAssignment_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `SeatingTable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatAssignment` ADD CONSTRAINT `SeatAssignment_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatingRule` ADD CONSTRAINT `SeatingRule_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Poll` ADD CONSTRAINT `Poll_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Poll` ADD CONSTRAINT `Poll_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PollOption` ADD CONSTRAINT `PollOption_pollId_fkey` FOREIGN KEY (`pollId`) REFERENCES `Poll`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PollVote` ADD CONSTRAINT `PollVote_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `PollOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PollVote` ADD CONSTRAINT `PollVote_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Album` ADD CONSTRAINT `Album_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Album` ADD CONSTRAINT `Album_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_albumId_fkey` FOREIGN KEY (`albumId`) REFERENCES `Album`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaItem` ADD CONSTRAINT `MediaItem_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventDocument` ADD CONSTRAINT `EventDocument_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketType` ADD CONSTRAINT `TicketType_phaseId_fkey` FOREIGN KEY (`phaseId`) REFERENCES `Phase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_ticketTypeId_fkey` FOREIGN KEY (`ticketTypeId`) REFERENCES `TicketType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

