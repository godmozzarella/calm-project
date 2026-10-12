package com.calm.config;

import org.springframework.http.client.SimpleClientHttpRequestFactory;

/** Time limits keep a stalled upstream from occupying servlet threads indefinitely. */
public final class OutboundHttp {
	private OutboundHttp() {}

	public static SimpleClientHttpRequestFactory requestFactory() {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(5_000);
		factory.setReadTimeout(10_000);
		return factory;
	}
}
