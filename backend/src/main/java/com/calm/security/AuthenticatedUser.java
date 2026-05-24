package com.calm.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.security.Principal;
import java.util.Collection;
import java.util.List;

/** Принципал, который кладётся в SecurityContext после валидации JWT. */
public class AuthenticatedUser implements Principal {

    private static final Collection<GrantedAuthority> AUTHORITIES =
            List.of(new SimpleGrantedAuthority("ROLE_USER"));

    private final String userId;
    private final String email;

    public AuthenticatedUser(String userId, String email) {
        this.userId = userId;
        this.email  = email;
    }

    public String getUserId() { return userId; }
    public String getEmail()  { return email; }

    public Collection<GrantedAuthority> getAuthorities() { return AUTHORITIES; }

    @Override
    public String getName() { return email; }
}
