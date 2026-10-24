package com.calm.feature.forecast;

/** Conversion at the weather-provider boundary; persisted forecast values use mmHg. */
public final class PressureUnits {
	public static final double MMHG_PER_HPA = 0.750062;

	private PressureUnits() {}

	public static Double mmHg(Double hpa) {
		return hpa == null ? null : hpa * MMHG_PER_HPA;
	}

	public static Double roundedMmHg(Double hpa) {
		Double value = mmHg(hpa);
		return value == null ? null : Math.round(value * 10.0) / 10.0;
	}
}
