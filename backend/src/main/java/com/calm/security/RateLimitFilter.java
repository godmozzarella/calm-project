package com.calm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window rate limiter для /auth/login и /auth/register.
 * Не более {@code calm.rate-limit.auth.max-attempts} запросов с одного IP
 * за {@code calm.rate-limit.auth.window-seconds} секунд.
 * При превышении возвращает 429 с заголовком Retry-After.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

	private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

	private final int maxAttempts;
	private final long windowMs;

	private final ConcurrentHashMap<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

	public RateLimitFilter(
			@Value("${calm.rate-limit.auth.max-attempts:10}") int maxAttempts,
			@Value("${calm.rate-limit.auth.window-seconds:60}") int windowSeconds
	) {
		this.maxAttempts = maxAttempts;
		this.windowMs = windowSeconds * 1000L;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		String path = request.getServletPath();
		return !path.equals("/auth/login") && !path.equals("/auth/register");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
			throws ServletException, IOException {

		String ip = resolveIp(req);
		long now = System.currentTimeMillis();

		Deque<Long> bucket = buckets.computeIfAbsent(ip, k -> new ArrayDeque<>());

		synchronized (bucket) {
			long cutoff = now - windowMs;
			while (!bucket.isEmpty() && bucket.peekFirst() < cutoff) bucket.pollFirst();

			if (bucket.size() >= maxAttempts) {
				int retryAfterSec = (int) Math.max(1, (bucket.peekFirst() + windowMs - now + 999) / 1000);
				log.warn("Rate limit exceeded: ip={}, path={}, retry-after={}s", ip, req.getServletPath(), retryAfterSec);
				res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
				res.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
				res.setHeader("Retry-After", String.valueOf(retryAfterSec));
				res.getWriter().write(
						"{\"error\":\"Слишком много попыток. Попробуйте через " + retryAfterSec + " сек.\"}");
				return;
			}
			bucket.addLast(now);
		}

		chain.doFilter(req, res);
	}

	private static String resolveIp(HttpServletRequest req) {
		String forwarded = req.getHeader("X-Forwarded-For");
		if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
		return req.getRemoteAddr();
	}
}
