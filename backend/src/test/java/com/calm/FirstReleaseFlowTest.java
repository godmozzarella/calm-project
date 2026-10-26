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

@SpringBootTest(properties = "calm.rate-limit.auth.max-attempts=100")
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
		assertThat(first.at("/user/emailVerified").asBoolean()).isFalse();
		String firstToken = first.get("token").asText();
		String secondToken = second.get("token").asText();
		String loginRequest = json.createObjectNode().put("email", firstEmail)
				.put("password", "StrongPassword123!").toString();
		mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginRequest))
				.andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("USER"));

		verifyNoInteractions(email);
		mvc.perform(patch("/users/me").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"latitude\":55.75,\"longitude\":37.62,\"city\":\"Москва\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.notificationsEnabled").value(false));
		mvc.perform(patch("/users/me").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content("{\"notificationsEnabled\":true}"))
				.andExpect(status().isConflict());
		mvc.perform(post("/auth/send-verification-code").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isNoContent());
		var emailHtml = org.mockito.ArgumentCaptor.forClass(String.class);
		verify(email).send(eq(firstEmail), any(), emailHtml.capture());
		Matcher code = Pattern.compile("<strong>(\\d{4})</strong>").matcher(emailHtml.getValue());
		assertThat(code.find()).isTrue();
		mvc.perform(post("/auth/verify-email").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code.group(1) + "\"}"))
				.andExpect(status().isNoContent());
		mvc.perform(get("/users/me").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));
		mvc.perform(patch("/users/me").header("Authorization", "Bearer " + firstToken)
				.contentType(MediaType.APPLICATION_JSON).content("{\"notificationsEnabled\":true}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.notificationsEnabled").value(true));

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

	private JsonNode register(String emailAddress) throws Exception {
		String request = json.createObjectNode().put("email", emailAddress)
				.put("name", "Pilot user").put("password", "StrongPassword123!").toString();
		String body = mvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
				.content(request)).andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
		return json.readTree(body);
	}
}
