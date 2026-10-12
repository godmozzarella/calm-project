package com.calm;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
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
	@MockitoBean EmailService email;

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

		var emailHtml = org.mockito.ArgumentCaptor.forClass(String.class);
		verify(email).send(eq(firstEmail), any(), emailHtml.capture());
		Matcher link = Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(emailHtml.getValue());
		assertThat(link.find()).isTrue();
		mvc.perform(post("/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\"" + link.group(1) + "\"}"))
				.andExpect(status().isNoContent());
		mvc.perform(get("/users/me").header("Authorization", "Bearer " + firstToken))
				.andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));

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
