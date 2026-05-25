package com.calm.config;

import com.calm.feature.attack.Attack;
import com.calm.feature.dictionary.DictionaryEntry;
import com.calm.feature.medication.Medication;
import com.calm.feature.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.stereotype.Component;

/**
 * Принудительно создаёт индексы по аннотациям моделей при старте приложения.
 * Нужен в prod-профиле, где {@code spring.data.mongodb.auto-index-creation=false}.
 * В dev по сути дублирует встроенную автогенерацию, но погоды не делает — индекс
 * не пересоздаётся если уже есть.
 *
 * <p>Запускается на {@link ApplicationReadyEvent}, чтобы выполниться после {@code DictionarySeeder}
 * — порядок не критичен, но логичнее.
 */
@Component
public class MongoIndexInitializer {

	private static final Logger log = LoggerFactory.getLogger(MongoIndexInitializer.class);

	private static final Class<?>[] INDEXED_ENTITIES = {
			User.class,
			Attack.class,
			Medication.class,
			DictionaryEntry.class,
	};

	private final MongoTemplate mongoTemplate;
	private final MongoMappingContext mappingContext;

	public MongoIndexInitializer(MongoTemplate mongoTemplate, MongoMappingContext mappingContext) {
		this.mongoTemplate = mongoTemplate;
		this.mappingContext = mappingContext;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void ensureIndexes() {
		IndexResolver resolver = new MongoPersistentEntityIndexResolver(mappingContext);
		for (Class<?> clazz : INDEXED_ENTITIES) {
			var ops = mongoTemplate.indexOps(clazz);
			resolver.resolveIndexFor(clazz).forEach(ops::ensureIndex);
		}
		log.info("Индексы Mongo проверены для {} коллекций", INDEXED_ENTITIES.length);
	}
}
