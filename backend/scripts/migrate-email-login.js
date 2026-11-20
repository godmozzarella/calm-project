// Run with mongosh against the Calm application database.
const direction = process.env.CALM_EMAIL_LOGIN_MIGRATION;
if (!["up", "down"].includes(direction)) {
  throw new Error("Set CALM_EMAIL_LOGIN_MIGRATION=up or down");
}
if (["admin", "config", "local", "test"].includes(db.getName())) {
  throw new Error("Select the Calm application database");
}

const challenges = db.getCollection("email_login_challenges");
if (direction === "up") {
  challenges.createIndex({ tokenHash: 1 }, { name: "tokenHash" });
  challenges.createIndex({ expiresAt: 1 }, { name: "expiresAt", expireAfterSeconds: 0 });
  const result = db.users.updateMany(
    {
      legacyPasswordAuth: { $exists: false },
      $or: [
        { passwordHash: { $type: "string" } },
        { emailVerificationCodeHash: { $type: "string" } },
        { passwordResetCodeHash: { $type: "string" } },
        { passwordResetTokenHash: { $type: "string" } },
      ],
    },
    { $set: { legacyPasswordAuth: "retired-v1" } },
  );
  printjson({ direction, markedAccounts: result.modifiedCount });
} else {
  const result = db.users.updateMany(
    { legacyPasswordAuth: "retired-v1" },
    { $unset: { legacyPasswordAuth: "" } },
  );
  // Older releases cannot distinguish the current-address and new-address proofs.
  db.users.updateMany({ pendingEmailChangeStage: { $exists: true } }, {
    $unset: {
      pendingEmailChangeStage: "", pendingEmailChangeAddress: "", pendingEmailChangeCodeHash: "",
      pendingEmailChangeExpiresAt: "", pendingEmailChangeSentAt: "", pendingEmailChangeAttempts: "",
      pendingEmailChangeCancelTokenHash: "", pendingEmailChangeCancelExpiresAt: "",
    },
  });
  // Only ephemeral requests are removed. Users and sessions are separate collections.
  challenges.drop();
  printjson({ direction, unmarkedAccounts: result.modifiedCount });
}
