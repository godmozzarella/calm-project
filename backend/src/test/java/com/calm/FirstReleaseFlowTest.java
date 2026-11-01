package com.calm;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.medication.MedicationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import java.time.LocalDate;
import java.time.ZoneOffset;
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

	@Test
	void todayCanBeMarkedQuietAndLaterAttackReplacesTheMark() throws Exception {
		JsonNode account = register("outcome-" + UUID.randomUUID() + "@example.test");
		String token = account.get("token").asText();
		String date = LocalDate.now(ZoneOffset.UTC).toString();
		String auth = "Bearer " + token;

		mvc.perform(post("/risk/outcome/no-attack").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"date\":\"" + date + "\",\"timezone\":\"UTC\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_ATTACK"));
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_ATTACK"));

		String attack = mvc.perform(post("/attacks").header("Authorization", auth)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"startDate\":\"" + date + "\",\"startTime\":\"00:01\","
						+ "\"endDate\":\"" + date + "\",\"endTime\":\"01:00\","
						+ "\"ongoing\":false,\"intensity\":5,\"type\":\"PULSATING\","
						+ "\"symptoms\":[],\"triggers\":[],\"painZones\":{}}"))
				.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ATTACK_PRESENT"));
		mvc.perform(delete("/attacks/" + json.readTree(attack).get("id").asText())
					.header("Authorization", auth)).andExpect(status().isNoContent());
		mvc.perform(get("/risk/outcome").header("Authorization", auth).param("date", date))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UNKNOWN"));
	}

	@Test
	void registrationEmailVerificationAndAttackOwnership() throws Exception {
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
		String loginRequest = json.createObjectNode().put("email", firstEmail)
				.put("password", "StrongPassword123!").toString();
		mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginRequest))
				.andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("USER"));

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
		mvc.perform(get("/medications/" + customId).header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Мой препарат"));
		mvc.perform(get("/stats").header("Authorization", "Bearer " + secondToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.kpis.total").value(0));
	}

    @Autowired com.calm.feature.user.UserRepository users;
    @Autowired org.springframework.data.mongodb.core.MongoTemplate mongo;

    @Test
    void pendingRegistrationCannotLoginAndCancellationDoesNotCreateAnAccount() throws Exception {
        when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);
        String address = "pending-" + UUID.randomUUID() + "@example.test";
        String body = json.createObjectNode().put("email", address).put("name", "Pending")
                .put("password", "StrongPassword123!").toString();
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/auth/verify-registration").contentType(MediaType.APPLICATION_JSON)
                .content(json.readTree(body).deepCopy().toString().replace("\"name\":\"Pending\"", "\"code\":\"abcd\"")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/cancel-registration").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent());
        assertThat(users.findByEmail(address)).isEmpty();
        register(address);
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
    }

    @Test
    void passwordChangeRevokesSessionsButRetainsBackdatedDiaryWithoutForecast() throws Exception {
        String address = "security-" + UUID.randomUUID() + "@example.test";
        JsonNode account = register(address);
        String auth = "Bearer " + account.get("token").asText();
        String attackBody = """
            {"startDate":"2020-01-01","startTime":"10:00","endDate":"2020-01-01","endTime":"10:00",
             "ongoing":false,"intensity":5,"type":"PULSATING"}
            """;
        JsonNode attack = json.readTree(mvc.perform(post("/attacks").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content(attackBody)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        mvc.perform(post("/users/me/password").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"OtherPassword123!\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Неверный пароль"));
        mvc.perform(post("/users/me/password").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"StrongPassword123!\",\"newPassword\":\"OtherPassword123!\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(status().isUnauthorized());
        JsonNode login = json.readTree(mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("password", "OtherPassword123!").toString()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(get("/attacks/" + attack.get("id").asText()).header("Authorization", "Bearer " + login.get("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.startDate").value("2020-01-01"));
    }

    private String latestCode(String address, int digits) {
        var html = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(eq(address), any(), html.capture());
        Matcher code = Pattern.compile("<strong>(\\d{" + digits + "})</strong>").matcher(html.getValue());
        assertThat(code.find()).isTrue();
        return code.group(1);
    }

    @Test
    void recoveryCodeIsOneTimeAndOldSessionIsRevoked() throws Exception {
        String address = "reset-" + UUID.randomUUID() + "@example.test";
        JsonNode account = register(address);
        mvc.perform(post("/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).toString())).andExpect(status().isNoContent());
        String code = latestCode(address, 6);
        String verificationRequest = json.createObjectNode().put("email", address).put("code", code).toString();
        mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("code", code.equals("000000") ? "111111" : "000000").toString()))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("code", code).put("newPassword", "RecoveredPassword123!").toString()))
                .andExpect(status().isBadRequest());
        JsonNode verified = json.readTree(mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON)
                .content(verificationRequest)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON).content(verificationRequest))
                .andExpect(status().isBadRequest());
        String request = json.createObjectNode().put("email", address).put("verificationToken", verified.get("verificationToken").asText())
                .put("newPassword", "RecoveredPassword123!").toString();
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("verificationToken", verified.get("verificationToken").asText()).put("newPassword", "short").toString()))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isNoContent());
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/users/me").header("Authorization", "Bearer " + account.get("token").asText()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recoveryCodeLocksAfterFiveWrongAttempts() throws Exception {
        String address = "reset-lock-" + UUID.randomUUID() + "@example.test";
        register(address);
        mvc.perform(post("/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).toString())).andExpect(status().isNoContent());
        String code = latestCode(address, 6);
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON)
                    .content(json.createObjectNode().put("email", address).put("code", wrong).toString()))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("code", code).toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void recoveryGrantIsBoundToEmailAndExpires() throws Exception {
        String address = "reset-expiry-" + UUID.randomUUID() + "@example.test";
        register(address);
        mvc.perform(post("/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).toString())).andExpect(status().isNoContent());
        JsonNode verified = json.readTree(mvc.perform(post("/auth/password-reset/verify").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("code", latestCode(address, 6)).toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString());
        String grant = verified.get("verificationToken").asText();
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", "different@example.test").put("verificationToken", grant)
                        .put("newPassword", "RecoveredPassword123!").toString())).andExpect(status().isBadRequest());
        mongo.updateFirst(org.springframework.data.mongodb.core.query.Query.query(
                org.springframework.data.mongodb.core.query.Criteria.where("email").is(address)),
                new org.springframework.data.mongodb.core.query.Update().set("passwordResetExpiresAt", java.time.Instant.now().minusSeconds(1)),
                com.calm.feature.user.User.class);
        mvc.perform(post("/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("verificationToken", grant)
                        .put("newPassword", "RecoveredPassword123!").toString())).andExpect(status().isBadRequest());
    }

    @Test
    void emailChangeKeepsOldAddressUntilCodeAndRevokesSessions() throws Exception {
        String address = "email-" + UUID.randomUUID() + "@example.test";
        String next = "next-" + UUID.randomUUID() + "@example.test";
        JsonNode account = register(address);
        String auth = "Bearer " + account.get("token").asText();
        mvc.perform(post("/users/me/email-change").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("currentPassword", "StrongPassword123!").put("newEmail", next).toString()))
                .andExpect(status().isOk());
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(jsonPath("$.email").value(address));
        mvc.perform(post("/users/me/email-change/confirm").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("code", latestCode(next, 6)).toString())).andExpect(status().isNoContent());
        assertThat(users.findByEmail(address)).isEmpty();
        assertThat(users.findByEmail(next)).isPresent();
        mvc.perform(get("/users/me").header("Authorization", auth)).andExpect(status().isUnauthorized());
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
        JsonNode admin = json.readTree(mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", address).put("password", "StrongPassword123!").toString()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
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
        when(email.send(any(), any(), any())).thenReturn(EmailSendResult.SENT);
        String request = json.createObjectNode().put("email", emailAddress)
                .put("name", "Pilot user").put("password", "StrongPassword123!").toString();
        mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(request)).andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist());
        var html = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(eq(emailAddress), any(), html.capture());
        Matcher code = Pattern.compile("<strong>(\\d{4})</strong>").matcher(html.getValue());
        assertThat(code.find()).isTrue();
        String body = mvc.perform(post("/auth/verify-registration").contentType(MediaType.APPLICATION_JSON)
                .content(json.createObjectNode().put("email", emailAddress).put("password", "StrongPassword123!")
                    .put("code", code.group(1)).toString())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }
}
