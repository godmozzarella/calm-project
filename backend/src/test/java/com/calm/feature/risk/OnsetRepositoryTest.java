package com.calm.feature.risk;

import com.calm.feature.attack.*;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

@DataMongoTest
@ActiveProfiles("test")
class OnsetRepositoryTest {
    @Autowired OnsetInputRepository inputs;
    @Autowired OnsetLabelRepository labels;
    @Autowired AttackRepository attacks;
    @Autowired MongoTemplate mongo;

    @Test void immutableInputsNullableFeaturesAndLabelRevisionsRoundTrip() {
        var day = LocalDate.of(2026, 11, 3);
        var start = day.atStartOfDay(ZoneOffset.UTC).toInstant();
        var features = new LinkedHashMap<String, Object>(); features.put("unknown", null);
        var value = new OnsetInputSnapshot("round-trip", "test-onset", day, "UTC", start,
                start.plusSeconds(86400), start.minusSeconds(30), 4, OnsetInputSnapshot.PROTOCOL,
                DailyOutcome.NEW_START_DEFINITION, "test", "digest", features, Map.of(), true, List.of());
        inputs.insert(value);
        assertThat(inputs.findById(value.id()).orElseThrow().features()).containsKey("unknown");
        assertThatThrownBy(() -> inputs.insert(value)).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        var first = labels.save(new OnsetDailyLabel("round-trip", "test-onset", day, "UTC", 0,
                true, true, start.plusSeconds(86400), "USER_NO_NEW_START_MARK", start, start, 1,
                List.of(), List.of(new OnsetDailyLabel.Revision(1, start, 0, true, true,
                    "USER_NO_NEW_START_MARK", start, List.of())), null));
        var second = labels.save(new OnsetDailyLabel(first.id(), first.userId(), day, "UTC", 1,
                true, true, first.finalizedAt(), "ATTACK_START", null, start.plusSeconds(90000), 2,
                List.of("attack"), first.revisions(), first.lockVersion()));
        assertThat(second.lockVersion()).isGreaterThan(first.lockVersion());
        assertThat(labels.findById(first.id()).orElseThrow().outcome()).isEqualTo(1);
        assertThat(inputs.findById(value.id()).orElseThrow().capturedAt()).isEqualTo(value.capturedAt());
    }

    @Test void localTimeTextSurvivesRealMongoStorageRegardlessOfBsonDateRepresentation() {
        var attack = new Attack(); attack.setUserId("time-round-trip"); attack.setStartDate(LocalDate.of(2026, 11, 3));
        attack.setStartTime(LocalTime.of(10, 15)); attack.setEndTime(LocalTime.of(11, 45));
        var saved = attacks.save(attack);
        var raw = mongo.getCollection("attacks").find(new Document("_id", new org.bson.types.ObjectId(saved.getId()))).first();
        assertThat(raw).isNotNull();
        assertThat(raw.getString("startTimeText")).isEqualTo("10:15");
        assertThat(raw.getString("endTimeText")).isEqualTo("11:45");
        assertThat(attacks.findById(saved.getId()).orElseThrow().getStartTime()).isEqualTo(LocalTime.of(10, 15));
    }
}
