package com.calm.feature.auth;

import com.mongodb.client.result.UpdateResult;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionServiceTest {
	@Mock private AuthSessionRepository repository;
	@Mock private MongoTemplate mongoTemplate;

	@Test
	void expiredSessionCannotBeTouched() {
		AuthSessionService service = new AuthSessionService(repository, mongoTemplate);
		when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(AuthSession.class)))
				.thenReturn(UpdateResult.acknowledged(0, 0L, null));

		assertThat(service.touch("session-1", "user-1")).isFalse();

		ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
		verify(mongoTemplate).updateFirst(query.capture(), any(Update.class), eq(AuthSession.class));
		Document filter = query.getValue().getQueryObject();
		assertThat(filter.getString("_id")).isEqualTo("session-1");
		assertThat(filter.getString("userId")).isEqualTo("user-1");
		assertThat((Document) filter.get("lastActivity")).containsKey("$gt");
		assertThat((Document) filter.get("expiresAt")).containsKey("$gt");
	}

	@Test
	void refreshRotatesTokenWithoutExtendingActivity() {
		AuthSessionService service = new AuthSessionService(repository, mongoTemplate);
		when(mongoTemplate.findAndModify(any(Query.class), any(Update.class),
				any(FindAndModifyOptions.class), eq(AuthSession.class))).thenReturn(null);

		assertThat(service.refresh("old-token")).isNull();

		ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
		ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
		verify(mongoTemplate).findAndModify(query.capture(), update.capture(),
				any(FindAndModifyOptions.class), eq(AuthSession.class));
		Document filter = query.getValue().getQueryObject();
		assertThat(filter.getString("refreshToken")).isEqualTo("old-token");
		assertThat((Document) filter.get("lastActivity")).containsKey("$gt");
		assertThat((Document) filter.get("expiresAt")).containsKey("$gt");
		Document changes = (Document) update.getValue().getUpdateObject().get("$set");
		assertThat(changes).containsKeys("refreshToken", "expiresAt").doesNotContainKey("lastActivity");
	}
}
