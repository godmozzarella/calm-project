package com.calm;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CalmApplicationTests {

	@Test
	void contextLoads() {
		// Smoke: bean wiring + Mongo (embedded в test-профиле через de.flapdoodle.embed.mongo)
	}
}
