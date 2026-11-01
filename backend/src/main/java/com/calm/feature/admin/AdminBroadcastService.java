package com.calm.feature.admin;

import com.calm.common.exception.ConflictException;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.email.EmailService;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.util.List;

@Service
public class AdminBroadcastService {
	private static final Logger log = LoggerFactory.getLogger(AdminBroadcastService.class);
	private final UserRepository users;
	private final EmailService email;
	private final org.springframework.data.mongodb.core.MongoTemplate mongo;

	public AdminBroadcastService(UserRepository users, EmailService email, org.springframework.data.mongodb.core.MongoTemplate mongo) {
		this.users = users;
		this.mongo = mongo;
		this.email = email;
	}

	public long countRecipients() {
		return users.countByEmailVerifiedTrueAndNotificationsEnabledTrue();
	}

	public BroadcastResult send(String subject, String message, long expectedRecipientCount, String requestId) {
		List<User> recipients = users.findByEmailVerifiedTrueAndNotificationsEnabledTrue(Sort.by("_id"));
		if (recipients.size() != expectedRecipientCount) {
			throw new ConflictException("Число получателей изменилось. Проверьте его и подтвердите отправку заново.");
		}
		if (recipients.isEmpty()) {
			throw new ConflictException("Нет пользователей с включёнными email-уведомлениями.");
		}

        // A unique persisted attempt prevents duplicate sends after retry/restart.
        try {
            mongo.insert(new org.bson.Document("_id", requestId).append("state", "SENDING")
                    .append("createdAt", java.util.Date.from(java.time.Instant.now())), "admin_broadcast_jobs");
        } catch (org.springframework.dao.DuplicateKeyException duplicate) {
            org.bson.Document job = mongo.findById(requestId, org.bson.Document.class, "admin_broadcast_jobs");
            if (job != null && "DONE".equals(job.getString("state"))) {
                return new BroadcastResult(job.getInteger("recipientCount"), job.getInteger("sentCount"), job.getInteger("failedCount"));
            }
            throw new ConflictException("Эта рассылка уже запущена. Повторная отправка заблокирована во избежание дублей.");
        }
		String html = renderMessage(message);
		int sent = 0;
		int failed = 0;
		for (User original : recipients) {
            User recipient = users.findById(original.getId()).orElse(null);
            if (recipient == null || !recipient.isEmailVerified() || !recipient.isNotificationsEnabled()) { failed++; continue; }
			try {
				if (email.send(recipient.getEmail(), subject.trim(), html) == EmailSendResult.SENT) sent++;
				else failed++;
			} catch (Exception e) {
				failed++;
				log.warn("Ошибка массовой email-рассылки ({})", e.getClass().getSimpleName());
			}
		}
		mongo.updateFirst(org.springframework.data.mongodb.core.query.Query.query(
                org.springframework.data.mongodb.core.query.Criteria.where("_id").is(requestId)),
                new org.springframework.data.mongodb.core.query.Update().set("state", "DONE")
                    .set("recipientCount", recipients.size()).set("sentCount", sent).set("failedCount", failed), "admin_broadcast_jobs");
        return new BroadcastResult(recipients.size(), sent, failed);
	}

	private static String renderMessage(String message) {
		String escaped = HtmlUtils.htmlEscape(message.trim())
				.replace("\r\n", "\n")
				.replace('\r', '\n')
				.replace("\n", "<br>");
		return """
				<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f7;font-family:Arial,sans-serif;color:#20242a">
				<div style="max-width:600px;margin:0 auto;padding:28px;background:#fff;border-radius:16px;line-height:1.6">
				<p style="margin:0 0 20px">%s</p>
				<hr style="border:0;border-top:1px solid #e5e8eb;margin:24px 0">
				<p style="margin:0;color:#646b73;font-size:13px">Вы получили это письмо, потому что в профиле Calm включены email-уведомления. Изменить настройку можно в профиле.</p>
				</div></body></html>
				""".formatted(escaped);
	}

	public record BroadcastResult(int recipientCount, int sentCount, int failedCount) {}
}
