package com.calm.feature.user;

import com.calm.common.exception.NotFoundException;
import com.calm.common.exception.ConflictException;
import com.calm.feature.auth.AuthSessionRepository;
import com.calm.feature.user.dto.UpdateUserRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import java.util.Locale;
import java.util.Optional;

@Service
public class UserService {

	private final UserRepository repo;
	private final PasswordEncoder passwordEncoder;
	private final MongoTemplate mongo;
	public UserService(UserRepository repo, PasswordEncoder passwordEncoder, AuthSessionRepository sessions, MongoTemplate mongo) {
		this.repo = repo;
		this.mongo = mongo;
		this.passwordEncoder = passwordEncoder;
	}

	public User getById(String id) {
		return repo.findById(id)
				.orElseThrow(() -> new NotFoundException("Пользователь не найден"));
	}

	public Optional<User> findByEmail(String email) {
		return repo.findByEmail(normalizeEmail(email));
	}

	public User create(String email, String name, String rawPassword) {
        com.calm.security.PasswordPolicy.validate(rawPassword);
		email = normalizeEmail(email);
		if (repo.existsByEmail(email)) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
		User user = new User(email, name, passwordEncoder.encode(rawPassword));
		try {
			return repo.save(user);
		} catch (DuplicateKeyException e) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
	}

	public User createPendingRegistration(String email, String name, String rawPassword) {
        com.calm.security.PasswordPolicy.validate(rawPassword);
		email = normalizeEmail(email);
		if (repo.existsByEmail(email)) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
		User user = new User(email, name, passwordEncoder.encode(rawPassword));
		user.setRegistrationPending(true);
		try {
			return repo.save(user);
		} catch (DuplicateKeyException e) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
	}

	public User updatePendingRegistration(String id, String name) {
		User user = getById(id);
		if (!user.isRegistrationPending() || user.isEmailVerified()) {
			throw new ConflictException("Эту регистрацию уже нельзя продолжить");
		}
		User updated = mongo.findAndModify(Query.query(Criteria.where("_id").is(id)
                .and("registrationPending").is(true).and("emailVerified").ne(true)),
                new Update().set("name", name), FindAndModifyOptions.options().returnNew(true), User.class);
        if (updated == null) throw new ConflictException("Регистрация уже завершена или отменена");
        return updated;
	}

	public void deletePendingRegistration(String id) {
		User user = getById(id);
		if (!user.isRegistrationPending() || user.isEmailVerified()) {
			throw new ConflictException("Эту регистрацию уже нельзя отменить");
		}
        Query diary = Query.query(Criteria.where("userId").is(id));
        if (mongo.exists(diary, com.calm.feature.attack.Attack.class)
                || mongo.exists(diary, com.calm.feature.medication.Medication.class)) {
            throw new ConflictException("Аккаунт содержит записи дневника. Завершите подтверждение почты, чтобы сохранить доступ");
        }
		mongo.remove(Query.query(Criteria.where("_id").is(id)
                .and("registrationPending").is(true).and("emailVerified").ne(true)), User.class);
	}

	public User update(String id, UpdateUserRequest req) {
		User user = getById(id);

		Update update = new Update();
		if (req.name() != null) update.set("name", req.name());

        boolean locationChange = req.latitude() != null || req.longitude() != null || req.locationMode() != null;
        if (locationChange) {
            if (req.latitude() == null || req.longitude() == null) throw new ConflictException("Укажите координаты выбранного города");
            if (Boolean.TRUE.equals(req.automaticLocationUpdate()) && (!"AUTO".equals(user.getLocationMode())
                    || !"AUTO".equals(req.locationMode()) || req.expectedLocationVersion() == null)) {
                throw new ConflictException("Автоматическое изменение города отключено");
            }
            if (req.expectedLocationVersion() != null && req.expectedLocationVersion() != user.getLocationVersion()) {
                throw new ConflictException("Местоположение уже изменилось. Откройте выбор города снова");
            }
            String timezone = req.locationTimezone() == null ? user.getLocationTimezone() : req.locationTimezone();
            try { java.time.ZoneId.of(timezone); } catch (Exception e) { throw new ConflictException("Некорректный часовой пояс"); }
            String mode = req.locationMode() == null ? "MANUAL" : req.locationMode();
            if (!mode.equals("MANUAL") && !mode.equals("AUTO")) throw new ConflictException("Некорректный режим местоположения");
            var now = java.time.Instant.now();
            var history = new java.util.ArrayList<com.calm.feature.location.LocationHistoryEntry>();
            if (user.getLocationHistory().isEmpty() && user.getLatitude() != null && user.getLongitude() != null) {
                history.add(new com.calm.feature.location.LocationHistoryEntry(java.time.Instant.EPOCH,
                    new com.calm.feature.location.EventLocation(user.getLatitude(), user.getLongitude(), user.getCity(),
                        user.getLocationTimezone(), user.getLocationMode(), "LEGACY_PROFILE_ASSUMPTION", now)));
            }
            history.add(new com.calm.feature.location.LocationHistoryEntry(now,
                new com.calm.feature.location.EventLocation(req.latitude(), req.longitude(), req.city(), timezone, mode,
                    "CONFIRMED_" + mode, now)));
            update.set("latitude", req.latitude()).set("longitude", req.longitude()).set("city", req.city())
                .set("locationMode", mode).set("locationTimezone", timezone).inc("locationVersion", 1);
            update.push("locationHistory").each(history.toArray());
        }

		if (req.notificationsEnabled() != null) {
			if (req.notificationsEnabled() && !user.isEmailVerified()) {
				throw new ConflictException("Сначала подтвердите email, чтобы включить уведомления");
			}
			update.set("notificationsEnabled", req.notificationsEnabled());
		}

		if (update.getUpdateObject().isEmpty()) return user;
        Criteria criteria = Criteria.where("_id").is(id);
        if (locationChange) {
            if (user.getLocationVersion() == 0) criteria.orOperator(Criteria.where("locationVersion").is(0), Criteria.where("locationVersion").exists(false));
            else criteria.and("locationVersion").is(user.getLocationVersion());
            if (Boolean.TRUE.equals(req.automaticLocationUpdate())) criteria.and("locationMode").is("AUTO");
        }
        if (Boolean.TRUE.equals(req.notificationsEnabled())) criteria.and("emailVerified").is(true);
        User updated = mongo.findAndModify(Query.query(criteria), update,
                FindAndModifyOptions.options().returnNew(true), User.class);
        if (updated == null) throw new ConflictException("Данные аккаунта изменились. Обновите профиль");
        if (locationChange && !updated.getLocationHistory().isEmpty()) {
            var first = updated.getLocationHistory().get(0).location();
            var assumption = new com.calm.feature.location.EventLocation(first.latitude(), first.longitude(), first.city(),
                first.timezone(), first.mode(), "INITIAL_PROFILE_ASSUMPTION", java.time.Instant.now());
            var missing = Query.query(Criteria.where("userId").is(id).and("eventLocation").is(null));
            mongo.updateMulti(missing, new Update().set("eventLocation", assumption), com.calm.feature.attack.Attack.class);
            mongo.updateMulti(missing, new Update().set("eventLocation", assumption), com.calm.feature.medication.Medication.class);
        }
        return updated;
    }

    public void updateAvatar(String id, String url) {
        mongo.updateFirst(Query.query(Criteria.where("_id").is(id)), new Update().set("avatarUrl", url), User.class);
    }

	private static String normalizeEmail(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}
}
