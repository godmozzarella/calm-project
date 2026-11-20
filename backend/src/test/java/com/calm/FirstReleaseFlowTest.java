package com.calm;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.medication.MedicationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "calm.rate-limit.auth.max-attempts=1000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FirstReleaseFlowTest {
	@Autowired MockMvc mvc;
	@Autowired ObjectMapper json;
	@Autowired MedicationRepository medications;
	@MockitoBean EmailService email;
	@MockitoBean com.calm.feature.push.BrowserPushService push;
	@Autowired com.calm.feature.push.DevicePushSubscriptions deviceSubscriptions;

	@Test
	void cycleQuestionIsClaimedOnceAndWritesOnlyToTheOwnersCalendar() throws Exception {
		String auth = "Bearer " + register(address("cycle-owner")).get("token").asText();
		String other = "Bearer " + register(address("cycle-other")).get("token").asText();
		mvc.perform(put("/questionnaire/profile").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
				.content("{\"sex\":\"FEMALE\",\"age\":30,\"trackCycle\":true,\"confirmPlannedCycle\":false}"))
				.andExpect(status().isOk());
		mvc.perform(get("/questionnaire/profile").header("Authorization", auth))
				.andExpect(status().isOk()).andExpect(jsonPath("$.trackCycle").value(true))
				.andExpect(jsonPath("$.confirmPlannedCycle").value(false));
		String question = mvc.perform(post("/questionnaire/cycle/question?timezone=UTC").header("Authorization", auth))
				.andExpect(status().isOk()).andExpect(jsonPath("$.type").value("INITIAL"))
				.andReturn().getResponse().getContentAsString();
		mvc.perform(post("/questionnaire/cycle/question?timezone=UTC").header("Authorization", auth))
				.andExpect(status().isOk()).andExpect(content().string(""));
		LocalDate today = LocalDate.parse(json.readTree(question).get("today").asText());
		String date = today.minusDays(1).toString();
		String answer = "{\"question\":" + question + ",\"choice\":\"EARLIER\",\"date\":\"" + date + "\"}";
		mvc.perform(post("/questionnaire/cycle/answer?timezone=UTC").header("Authorization", other)
				.contentType(MediaType.APPLICATION_JSON).content(answer)).andExpect(status().isConflict());
		mvc.perform(post("/questionnaire/cycle/answer?timezone=UTC").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON).content(answer)).andExpect(status().isOk());
		mvc.perform(get("/questionnaire/cycle/overview?timezone=UTC").header("Authorization", auth))
				.andExpect(status().isOk()).andExpect(jsonPath("$.state").value("ONGOING"))
				.andExpect(jsonPath("$.history[0].start").value(date))
				.andExpect(jsonPath("$.history[0].startSource").value("CARD"));
		mvc.perform(get("/questionnaire/cycle/overview?timezone=UTC").header("Authorization", other))
				.andExpect(status().isOk()).andExpect(jsonPath("$.history").isEmpty());
		mvc.perform(put("/questionnaire/cycle/range?timezone=UTC").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON).content("{\"start\":\"" + date + "\",\"end\":\"" + today + "\"}"))
				.andExpect(status().isOk());
		mvc.perform(get("/questionnaire/cycle/overview?timezone=UTC").header("Authorization", auth))
				.andExpect(status().isOk()).andExpect(jsonPath("$.state").value("WAITING"))
				.andExpect(jsonPath("$.history[0].end").value(today.toString()));
		LocalDate plannedStart = today.plusDays(28);
		LocalDate plannedEnd = plannedStart.plusDays(4);
		mvc.perform(put("/questionnaire/cycle/range?timezone=UTC").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
						Map.of("start", plannedStart, "end", plannedEnd))))
				.andExpect(status().isOk());
		mvc.perform(get("/questionnaire/cycle").header("Authorization", auth))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.kind == 'PLANNED')].date", Matchers.contains(plannedStart.toString())))
				.andExpect(jsonPath("$[?(@.kind == 'PLANNED')].plannedEnd", Matchers.contains(plannedEnd.toString())));
	}

	@Test
	void completedQuestionnaireDatesContainOnlyTheSignedInUsersDays() throws Exception {
		String token = "Bearer " + register(address("survey-dates")).get("token").asText();
		String otherToken = "Bearer " + register(address("survey-dates-other")).get("token").asText();
		String date = LocalDate.now(ZoneOffset.UTC).toString();

		mvc.perform(post("/questionnaire").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
				.content("{\"date\":\"" + date + "\",\"timezone\":\"UTC\","
						+ "\"answers\":{\"yesterday\":\"NO\",\"today\":\"NO\",\"medicationYesterday\":\"NO\",\"alcoholYesterday\":\"NO\"}}"))
				.andExpect(status().isOk());
		mvc.perform(get("/questionnaire/completed-dates").header("Authorization", token))
				.andExpect(status().isOk()).andExpect(content().json("[\"" + date + "\"]"));
		mvc.perform(get("/questionnaire/completed-dates").header("Authorization", otherToken))
				.andExpect(status().isOk()).andExpect(content().json("[]"));
	}

    @Autowired com.calm.feature.risk.SharedModelParticipationRepository pilot;
    @Autowired com.calm.feature.risk.OnsetInputRepository onsetInputs;
    @Autowired com.calm.feature.risk.OnsetLabelRepository onsetLabels;

    @Test
    void ongoingAttackAllowsMarkAndLateNewStartRevisesLabelWithoutChangingInputs() throws Exception {
        JsonNode account = register("onset-" + UUID.randomUUID() + "@example.test");
        String userId = account.at("/user/id").asText();
        String auth = "Bearer " + account.get("token").asText();
        var consent = new com.calm.feature.risk.SharedModelParticipation(userId);
        consent.grant(com.calm.feature.risk.SharedModelConsentPolicy.VERSION,
            com.calm.feature.risk.SharedModelConsentPolicy.DIGEST, java.time.Instant.now());
        pilot.save(consent);
        LocalDate day = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        var cutoff = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        String snapshotId = com.calm.feature.risk.OnsetInputSnapshot.key(userId, day);
        onsetInputs.insert(new com.calm.feature.risk.OnsetInputSnapshot(snapshotId, userId, day, "UTC", cutoff,
            cutoff.plusSeconds(86400), cutoff.minusSeconds(30), 4,
            com.calm.feature.risk.OnsetInputSnapshot.PROTOCOL, com.calm.feature.risk.DailyOutcome.NEW_START_DEFINITION,
            com.calm.feature.risk.SharedModelConsentPolicy.VERSION, com.calm.feature.risk.SharedModelConsentPolicy.DIGEST,
            java.util.Map.of("episodeStartsLast7Days", 0), java.util.Map.of(), true, java.util.List.of()));
        mvc.perform(post("/attacks").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content("{\"startDate\":\"" + day.minusDays(2) + "\",\"startTime\":\"10:00\",\"ongoing\":true,\"intensity\":5,\"type\":\"PULSATING\"}"))
            .andExpect(status().isCreated());
        mvc.perform(post("/risk/outcome/no-new-attack").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content("{\"date\":\"" + day + "\",\"timezone\":\"UTC\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_ATTACK_STARTED"))
            .andExpect(jsonPath("$.headachePresent").value(true)).andExpect(jsonPath("$.dayCompleted").value(true));
        assertThat(onsetLabels.findById(snapshotId).orElseThrow().outcome()).isZero();
        String newAttack = mvc.perform(post("/attacks").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
            .content("{\"startDate\":\"" + day + "\",\"startTime\":\"13:00\",\"ongoing\":false,\"intensity\":5,\"type\":\"PULSATING\"}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(onsetLabels.findById(snapshotId).orElseThrow().outcome()).isEqualTo(1);
        assertThat(onsetInputs.findById(snapshotId).orElseThrow().features().get("episodeStartsLast7Days")).isEqualTo(0);
        mvc.perform(delete("/attacks/" + json.readTree(newAttack).get("id").asText()).header("Authorization", auth))
            .andExpect(status().isNoContent());
        assertThat(onsetLabels.findById(snapshotId).orElseThrow().outcome()).isNull();
        assertThat(onsetLabels.findById(snapshotId).orElseThrow().revisions().size()).isGreaterThanOrEqualTo(3);
    }

	@Test
	void todayCanBeMarkedQuietAndLaterAttackReplacesTheMark() throws Exception {
		JsonNode account = register("outcome-" + UUID.randomUUID() + "@example.test");
		String token = account.get("token").asText();
		String date = LocalDate.now(ZoneOffset.UTC).toString();
		String auth = "Bearer " + token;

		mvc.perform(post("/risk/outcome/no-attack").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"date\":\"" + date + "\",\"timezone\":\"UTC\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_ATTACK_STARTED"));
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_ATTACK_STARTED"));

		String attack = mvc.perform(post("/attacks").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"startDate\":\"" + date + "\",\"startTime\":\"00:01\","
						+ "\"endDate\":\"" + date + "\",\"endTime\":\"01:00\","
						+ "\"ongoing\":false,\"intensity\":5,\"type\":\"PULSATING\","
						+ "\"symptoms\":[],\"triggers\":[],\"painZones\":{}}"))
				.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ATTACK_STARTED"));
		mvc.perform(delete("/attacks/" + json.readTree(attack).get("id").asText())
					.header("Authorization", auth)).andExpect(status().isNoContent());
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UNKNOWN"));
	}

	@Test
	void emailLoginAndAttackOwnership() throws Exception {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		String firstEmail = "first-" + suffix + "@example.test";
		String secondEmail = "second-" + suffix + "@example.test";
		when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);

		JsonNode first = register(firstEmail);
		JsonNode second = register(secondEmail);
		assertThat(first.at("/user/role").asText()).isEqualTo("USER");
		assertThat(first.at("/user/emailVerified").asBoolean()).isTrue();
		String firstToken = first.get("token").asText();
		String secondToken = second.get("token").asText();

		String attackBody = """
				{"startDate":"2026-05-25","startTime":"10:00","endDate":"2026-05-25",
				 "endTime":"11:00","ongoing":false,"intensity":5,"type":"PULSATING",
				 "symptoms":["nausea"],"triggers":[],"painZones":{}}
				""";
		mvc.perform(post("/attacks").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(attackBody.replace("\"endTime\":\"11:00\"", "\"endTime\":\"09:00\"")))
				.andExpect(status().isBadRequest());
		String created = mvc.perform(post("/attacks").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content(attackBody))
				.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		String attackId = json.readTree(created).get("id").asText();
		mvc.perform(get("/attacks/" + attackId).header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isNotFound());
		mvc.perform(put("/attacks/" + attackId).header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content(attackBody.replace("\"nausea\"", "")))
				.andExpect(status().isOk());

		String medicationBody = """
				{"name":"Тестовый препарат","dosage":"1 таблетка","date":"2026-05-25","time":"11:30"}
				""";
		String medication = mvc.perform(post("/medications").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content(medicationBody))
				.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		String medicationId = json.readTree(medication).get("id").asText();
		mvc.perform(get("/medications/" + medicationId).header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isNotFound());
		String customBody = """
				{"name":"Мой препарат","category":"Другое","dosage":"100",
				 "date":"2026-05-25","time":"12:00"}
				""";
		String custom = mvc.perform(post("/medications").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content(customBody))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.name").value("Мой препарат"))
				.andReturn().getResponse().getContentAsString();
		String customId = json.readTree(custom).get("id").asText();
		String personalId = json.readTree(custom).get("personalMedicationId").asText();
		assertThat(medications.findById(customId).orElseThrow().getName()).isEqualTo("Свой препарат");
		mvc.perform(get("/medications/personal").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Мой препарат"));
		mvc.perform(get("/medications/personal").header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		mvc.perform(delete("/medications/personal/" + personalId)
				.header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isNotFound());
		mvc.perform(delete("/medications/personal/" + personalId)
				.header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isNoContent());
		mvc.perform(get("/medications/personal").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		mvc.perform(post("/medications/personal").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Новый свой препарат\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Новый свой препарат"));
		mvc.perform(get("/medications/personal").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Новый свой препарат"));
		mvc.perform(get("/medications/personal").header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		mvc.perform(get("/medications/" + customId).header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Мой препарат"));
		mvc.perform(get("/stats").header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.kpis.total").value(0));
	}

    @Autowired com.calm.feature.user.UserRepository users;
    @Autowired org.springframework.data.mongodb.core.MongoTemplate mongo;

    @Test
    void requestIsIdenticalForExistingAndNewAddressesAndExistingAccountKeepsItsId() throws Exception {
        String existing = address("legacy");
        String unknown = address("new");
        var user = new com.calm.feature.user.User(existing, "Старый аккаунт", "legacy-bcrypt-hash");
        user.setRegistrationPending(true);
        user = users.insert(user);

        var first = requestCode(" " + existing.toUpperCase(java.util.Locale.ROOT) + " ").andExpect(status().isNoContent()).andReturn().getResponse();
        var second = requestCode(unknown).andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(first.getContentAsString()).isEqualTo(second.getContentAsString()).isEmpty();
        assertThat(first.getHeader("Cache-Control")).isEqualTo(second.getHeader("Cache-Control"));
        assertThat(users.findByEmail(unknown)).isEmpty();
        verifyCode(existing, latestCode(existing, true)).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(user.getId())).andExpect(jsonPath("$.user.emailVerified").value(true));
        assertThat(users.findById(user.getId()).orElseThrow().getPasswordHash()).isEqualTo("legacy-bcrypt-hash");
        assertThat(users.findById(user.getId()).orElseThrow().isRegistrationPending()).isFalse();
    }

    @Test
    void codeAndLinkAreAlternativesAndCanBeUsedOnlyOnce() throws Exception {
        String address = address("one-time");
        requestCode(address).andExpect(status().isNoContent());
        String code = latestCode(address, true);
        String link = latestLink(address);
        verifyCode(address, "000000").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("четырёхзначный")));
        verifyCode(address, wrongCode(code)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Код неверный")));
        verifyCode(address, code).andExpect(status().isOk()).andExpect(cookie().httpOnly("calm_session", true))
                .andExpect(cookie().secure("calm_session", true)).andExpect(cookie().sameSite("calm_session", "Strict"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist());
        verifyCode(address, code).andExpect(status().isGone());
        verifyLink(link).andExpect(status().isGone());

        String second = address("link");
        requestCode(second).andExpect(status().isNoContent());
        String secondLink = latestLink(second);
        verifyLink(secondLink).andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(second));
        verifyLink(secondLink).andExpect(status().isGone());
        verifyCode(second, latestCode(second, true)).andExpect(status().isGone());
    }

    @Test
    void codeExpiresAndFifthFailureInvalidatesBothCredentials() throws Exception {
        String address = address("attempts");
        requestCode(address).andExpect(status().isNoContent());
        String code = latestCode(address, true);
        for (int attempt = 0; attempt < 4; attempt++) {
            verifyCode(address, wrongCode(code)).andExpect(status().isBadRequest());
        }
        verifyCode(address, wrongCode(code)).andExpect(status().isGone());
        verifyCode(address, code).andExpect(status().isGone());
        verifyLink(latestLink(address)).andExpect(status().isGone());

        String expired = address("expired");
        requestCode(expired).andExpect(status().isNoContent());
        setChallengeTime(expired, "expiresAt", java.time.Instant.now().minusSeconds(1));
        verifyCode(expired, latestCode(expired, true)).andExpect(status().isGone());
        verifyLink(latestLink(expired)).andExpect(status().isGone());
        assertThat(users.findByEmail(expired)).isEmpty();
    }

    @Test
    void emailCooldownPreventsDuplicateSendAndResendInvalidatesPreviousLink() throws Exception {
        String address = address("resend");
        requestCode(address).andExpect(status().isNoContent());
        String firstLink = latestLink(address);
        requestCode(address).andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        verify(email, times(1)).send(eq(address), any(), any(), any());
        setChallengeTime(address, "sentAt", java.time.Instant.now().minusSeconds(61));
        requestCode(address).andExpect(status().isNoContent());
        verifyLink(firstLink).andExpect(status().isGone());
        verifyCode(address, latestCode(address, true)).andExpect(status().isOk());
    }

    @Test
    void legacySessionMigratesAndCookieExpiresAfterThirtyIdleDays() throws Exception {
        String address = address("legacy-session");
        var user = users.insert(new com.calm.feature.user.User(address, "Legacy", "old-hash"));
        String id = UUID.randomUUID().toString();
        String refresh = UUID.randomUUID().toString();
        var now = java.time.Instant.now();
        mongo.getCollection("auth_sessions").insertOne(new org.bson.Document("_id", id).append("userId", user.getId())
                .append("refreshToken", refresh).append("lastActivity", java.util.Date.from(now.minusSeconds(86_400)))
                .append("expiresAt", java.util.Date.from(now.plusSeconds(86_400))));
        var migrated = mvc.perform(post("/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("refreshToken", refresh).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(user.getId())).andReturn().getResponse();
        var cookie = migrated.getCookie("calm_session");
        assertThat(cookie).isNotNull();
        String jwt = json.readTree(migrated.getContentAsString()).get("token").asText();
        mvc.perform(post("/auth/activity").cookie(cookie).header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNoContent()).andExpect(cookie().maxAge("calm_session", 30 * 24 * 3600));
        mvc.perform(post("/auth/refresh").cookie(cookie).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        mongo.getCollection("auth_sessions").updateOne(new org.bson.Document("_id", id),
                new org.bson.Document("$set", new org.bson.Document("lastActivity",
                        java.util.Date.from(now.minusSeconds(30L * 24 * 3600)))));
        mvc.perform(post("/auth/refresh").cookie(cookie).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private void setChallengeTime(String address, String field, java.time.Instant time) {
        mongo.getCollection("email_login_challenges").updateOne(new org.bson.Document("_id", address),
                new org.bson.Document("$set", new org.bson.Document(field, java.util.Date.from(time))));
    }

    private static String address(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.test";
    }

    private static String wrongCode(String code) {
        return code.equals("0000") ? "1111" : "0000";
    }

    private String latestCode(String address, boolean login) {
        var html = org.mockito.ArgumentCaptor.forClass(String.class);
        var plain = org.mockito.ArgumentCaptor.forClass(String.class);
        if (login) verify(email, atLeastOnce()).send(eq(address), any(), html.capture(), plain.capture());
        else verify(email, atLeastOnce()).send(eq(address), any(), html.capture());
        Matcher code = Pattern.compile("<strong>([0-9]{" + (login ? 4 : 6) + "})</strong>").matcher(html.getValue());
        assertThat(code.find()).isTrue();
        if (login) assertThat(plain.getValue()).contains("Код: " + code.group(1) + "\n");
        return code.group(1);
    }

    private String latestLink(String address) {
        var plain = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(eq(address), any(), any(), plain.capture());
        Matcher token = Pattern.compile("/email-login#([A-Za-z0-9_-]{43})").matcher(plain.getValue());
        assertThat(token.find()).isTrue();
        return token.group(1);
    }

    private org.springframework.test.web.servlet.ResultActions requestCode(String address) throws Exception {
        when(email.send(any(), any(), any(), any())).thenReturn(EmailSendResult.SENT);
        return mvc.perform(post("/auth/email/request").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).toString()));
    }

    private org.springframework.test.web.servlet.ResultActions verifyCode(String address, String code) throws Exception {
        return mvc.perform(post("/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("code", code).toString()));
    }

    private org.springframework.test.web.servlet.ResultActions verifyLink(String token) throws Exception {
        return mvc.perform(post("/auth/email/link").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("token", token).toString()));
    }

    @Test
    void emailChangeKeepsOldAddressUntilCodeAndRevokesSessions() throws Exception {
        String address = "email-" + UUID.randomUUID() + "@example.test";
        String next = "next-" + UUID.randomUUID() + "@example.test";
        JsonNode account = register(address);
        String auth = "Bearer " + account.get("token").asText();
        String attackBody = """
            {"startDate":"2020-01-01","startTime":"10:00","endDate":"2020-01-01","endTime":"10:00",
             "ongoing":false,"intensity":5,"type":"PULSATING"}
            """;
        String attack = mvc.perform(post("/attacks").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(attackBody)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);
        mvc.perform(post("/users/me/email-change").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("newEmail", next).toString()))
                .andExpect(status().isOk());
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(jsonPath("$.email").value(address));
        verify(email, never()).send(eq(next), any(), any());
        mvc.perform(post("/users/me/email-change/confirm").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("code", latestCode(address, false)).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.confirmCurrent").value(false));
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(jsonPath("$.email").value(address));
        mvc.perform(post("/users/me/email-change/confirm").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("code", latestCode(next, false)).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        assertThat(users.findByEmail(address)).isEmpty();
        assertThat(users.findByEmail(next)).isPresent();
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(status().isUnauthorized());
        JsonNode signedIn = register(next);
        assertThat(signedIn.at("/user/id")).isEqualTo(account.at("/user/id"));
        mvc.perform(get("/attacks/" + json.readTree(attack).get("id").asText())
                .header("Authorization", "Bearer " + signedIn.get("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.startDate").value("2020-01-01"));

    }

    @Test
    void cancelLinkPreventsAnOutstandingEmailChangeFromCompleting() throws Exception {
        String current = address("cancel");
        String next = address("cancel-next");
        JsonNode account = register(current);
        String auth = "Bearer " + account.get("token").asText();
        when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);
        mvc.perform(post("/users/me/email-change").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("newEmail", next).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.confirmCurrent").value(true));

        var html = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email).send(eq(current), eq("Подтверждение смены почты Calm"), html.capture());
        Matcher token = Pattern.compile("/cancel-email-change#([A-Za-z0-9_-]{43})").matcher(html.getValue());
        assertThat(token.find()).isTrue();
        mvc.perform(post("/auth/cancel-email-change").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("token", token.group(1)).toString()))
                .andExpect(status().isNoContent());
        mvc.perform(post("/users/me/email-change/confirm").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("code", latestCode(current, false)).toString()))
                .andExpect(status().isConflict());
        assertThat(users.findByEmail(next)).isEmpty();
        assertThat(users.findByEmail(current)).isPresent();
    }

    @Test
    void broadcastRequiresAdminAndSameAttemptCannotSendTwice() throws Exception {
        String address = "admin-" + UUID.randomUUID() + "@example.test";
        JsonNode account = register(address);
        String auth = "Bearer " + account.get("token").asText();
        mvc.perform(get("/admin/broadcast/audience").header("Authorization", auth)).andExpect(status().isForbidden());
        mongo.updateFirst(org.springframework.data.mongodb.core.query.Query.query(
                org.springframework.data.mongodb.core.query.Criteria.where("email").is(address)),
                new org.springframework.data.mongodb.core.query.Update().set("role", "ADMIN").set("notificationsEnabled", true),
                com.calm.feature.user.User.class);
        setChallengeTime(address, "sentAt", java.time.Instant.now().minusSeconds(61));
        JsonNode admin = register(address);
        when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);
        auth = "Bearer " + admin.get("token").asText();
        long count = users.countByEmailVerifiedTrueAndNotificationsEnabledTrue();
        String request = json.createObjectNode().put("subject", "Update").put("message", "<script>unsafe</script>")
                .put("expectedRecipientCount", count).put("requestId", UUID.randomUUID().toString().replace("-", "")).toString();
        clearInvocations(email);
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/admin/broadcast").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(request))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.sentCount").value(count));
        }
        verify(email, times((int)count)).send(any(), eq("Update"), contains("&lt;script&gt;"));
    }

    @Test
    void deviceSubscriptionsAreIndependentOfEmailAndOwnedByAccount() throws Exception {
        when(push.available()).thenReturn(true);
        JsonNode first = register(address("device"));
        JsonNode second = register(address("other-device"));
        String owner = "Bearer " + first.get("token").asText();
        String other = "Bearer " + second.get("token").asText();
        String route = "/users/me/device-notifications";
        String endpoint = "https://fcm.googleapis.com/fcm/send/device-test";
        String body = json.createObjectNode().put("endpoint", endpoint).toString();
        String subscription = json.createObjectNode().put("endpoint", endpoint)
                .set("keys", json.createObjectNode().put("auth", "test").put("p256dh", "test")).toString();

        mvc.perform(put(route).contentType(MediaType.APPLICATION_JSON).content(subscription)).andExpect(status().isUnauthorized());
        mvc.perform(put(route).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content(subscription))
                .andExpect(status().isNoContent());
        mvc.perform(get("/users/me").header("Authorization", owner)).andExpect(jsonPath("$.notificationsEnabled").value(false));
        mvc.perform(post(route + "/status").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(true));
        mvc.perform(delete(route).header("Authorization", other).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent());
        mvc.perform(post(route + "/status").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.enabled").value(true));
        mvc.perform(post(route + "/status").header("Authorization", other).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.enabled").value(false));

        var device = deviceSubscriptions.batchAfter(null).stream()
                .filter(item -> item.endpoint().equals(endpoint)).findFirst().orElseThrow();
        LocalDate day = LocalDate.of(2026, 11, 19);
        assertThat(deviceSubscriptions.claim(device, day)).isTrue();
        assertThat(deviceSubscriptions.claim(device, day)).isFalse();

        mvc.perform(delete(route).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent());
        mvc.perform(post(route + "/status").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.enabled").value(false));
    }

    @Test
    void avatarRejectsActiveContentAndFakeImageMime() throws Exception {
        JsonNode account = register("avatar-" + UUID.randomUUID() + "@example.test");
        String auth = "Bearer " + account.get("token").asText();
        for (String mime : new String[]{"image/svg+xml", "image/png"}) {
            var file = new org.springframework.mock.web.MockMultipartFile("file", "fake.png", mime,
                    "<svg onload='alert(1)'></svg>".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            mvc.perform(multipart("/users/me/avatar").file(file).header("Authorization", auth))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void manualLocationIsStrictAndOldEventLocationSurvivesFutureMoves() throws Exception {
        JsonNode account = register("location-" + UUID.randomUUID() + "@example.test");
        String auth = "Bearer " + account.get("token").asText();
        String legacyBody = "{\"startDate\":\"2019-01-01\",\"startTime\":\"10:00\",\"ongoing\":false,\"intensity\":5,\"type\":\"PULSATING\"}";
        JsonNode legacy = json.readTree(mvc.perform(post("/attacks").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(legacyBody)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        mvc.perform(patch("/users/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":55,\"longitude\":37,\"city\":\"A\",\"locationMode\":\"MANUAL\",\"locationTimezone\":\"UTC\",\"expectedLocationVersion\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locationMode").value("MANUAL"));
        assertThat(mongo.findById(legacy.get("id").asText(), com.calm.feature.attack.Attack.class).getEventLocation().city()).isEqualTo("A");
        String body = "{\"startDate\":\"2020-01-01\",\"startTime\":\"10:00\",\"ongoing\":false,\"intensity\":5,\"type\":\"PULSATING\"}";
        JsonNode attack = json.readTree(mvc.perform(post("/attacks").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        String id = attack.get("id").asText();
        assertThat(mongo.findById(id, com.calm.feature.attack.Attack.class).getEventLocation().city()).isEqualTo("A");
        JsonNode medicine = json.readTree(mvc.perform(post("/medications").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Ибупрофен\",\"dosage\":\"200\",\"date\":\"2020-01-01\",\"time\":\"11:00\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(mongo.findById(medicine.get("id").asText(), com.calm.feature.medication.Medication.class).getEventLocation().city()).isEqualTo("A");
        mvc.perform(patch("/users/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":60,\"longitude\":30,\"city\":\"B\",\"locationMode\":\"AUTO\",\"expectedLocationVersion\":1,\"automaticLocationUpdate\":true}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(jsonPath("$.city").value("A"));
        mvc.perform(patch("/users/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":60,\"longitude\":30,\"city\":\"B\",\"locationMode\":\"AUTO\",\"expectedLocationVersion\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locationMode").value("AUTO"));
        mvc.perform(put("/attacks/" + id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(body.replace("\"intensity\":5", "\"intensity\":7"))).andExpect(status().isOk());
        assertThat(mongo.findById(id, com.calm.feature.attack.Attack.class).getEventLocation().city()).isEqualTo("A");
        mvc.perform(patch("/users/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":61,\"longitude\":31,\"city\":\"C\",\"locationMode\":\"AUTO\",\"expectedLocationVersion\":2,\"automaticLocationUpdate\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.city").value("C"));
        mvc.perform(patch("/users/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"latitude\":50,\"longitude\":20,\"city\":\"stale\",\"locationMode\":\"AUTO\",\"expectedLocationVersion\":2,\"automaticLocationUpdate\":true}"))
                .andExpect(status().isConflict());
    }

    private JsonNode register(String emailAddress) throws Exception {
        requestCode(emailAddress).andExpect(status().isNoContent());
        String body = verifyCode(emailAddress, latestCode(emailAddress, true)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }
}
