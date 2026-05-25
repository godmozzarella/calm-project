package com.calm.feature.user;

import com.calm.security.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
public class AvatarController {

	private static final Logger log = LoggerFactory.getLogger(AvatarController.class);
	private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB

	private final UserService userService;
	private final UserRepository userRepository;
	private final Path uploadDir;
	private final String baseUrl;

	public AvatarController(
			UserService userService,
			UserRepository userRepository,
			@Value("${calm.upload-dir:./uploads/avatars}") String uploadDir,
			@Value("${calm.base-url:http://localhost:8080}") String baseUrl
	) throws IOException {
		this.userService   = userService;
		this.userRepository = userRepository;
		this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
		this.baseUrl   = baseUrl;
		Files.createDirectories(this.uploadDir);
	}

	/** Загрузка аватара. Возвращает { avatarUrl }. */
	@PostMapping("/users/me/avatar")
	public Map<String, String> uploadAvatar(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestParam("file") MultipartFile file
	) throws IOException {
		if (file.isEmpty()) throw new IllegalArgumentException("Файл пустой");
		if (file.getSize() > MAX_SIZE_BYTES) throw new IllegalArgumentException("Файл больше 5 МБ");

		String contentType = file.getContentType();
		if (contentType == null || !contentType.startsWith("image/")) {
			throw new IllegalArgumentException("Только изображения (image/*)");
		}

		String ext = switch (contentType) {
			case "image/png"  -> ".png";
			case "image/gif"  -> ".gif";
			case "image/webp" -> ".webp";
			default           -> ".jpg";
		};

		String filename = UUID.randomUUID() + ext;
		Files.copy(file.getInputStream(), uploadDir.resolve(filename));

		String avatarUrl = baseUrl + "/api/public/avatars/" + filename;

		User user = userService.getById(principal.getUserId());
		// Удаляем старый файл если был
		deleteOldFile(user.getAvatarUrl());
		user.setAvatarUrl(avatarUrl);
		userRepository.save(user);

		log.info("Аватар загружен: user={}, file={}", principal.getUserId(), filename);
		return Map.of("avatarUrl", avatarUrl);
	}

	/** Удаление аватара. */
	@DeleteMapping("/users/me/avatar")
	public ResponseEntity<Void> deleteAvatar(@AuthenticationPrincipal AuthenticatedUser principal) {
		User user = userService.getById(principal.getUserId());
		deleteOldFile(user.getAvatarUrl());
		user.setAvatarUrl(null);
		userRepository.save(user);
		return ResponseEntity.noContent().build();
	}

	/** Публичная отдача файлов аватаров (без авторизации). */
	@GetMapping("/public/avatars/{filename:.+}")
	public ResponseEntity<Resource> serveAvatar(@PathVariable String filename, HttpServletRequest req) {
		try {
			Path file = uploadDir.resolve(filename).normalize();
			if (!file.startsWith(uploadDir)) return ResponseEntity.badRequest().build();
			Resource resource = new UrlResource(file.toUri());
			if (!resource.exists()) return ResponseEntity.notFound().build();

			String contentType = req.getServletContext().getMimeType(file.toString());
			if (contentType == null) contentType = "application/octet-stream";

			return ResponseEntity.ok()
					.header(HttpHeaders.CONTENT_TYPE, contentType)
					.header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
					.body(resource);
		} catch (MalformedURLException e) {
			return ResponseEntity.badRequest().build();
		}
	}

	private void deleteOldFile(String url) {
		if (url == null || url.isBlank()) return;
		try {
			String filename = url.substring(url.lastIndexOf('/') + 1);
			Path old = uploadDir.resolve(filename).normalize();
			if (old.startsWith(uploadDir)) Files.deleteIfExists(old);
		} catch (IOException e) {
			log.warn("Не удалось удалить старый аватар: {}", e.getMessage());
		}
	}
}
