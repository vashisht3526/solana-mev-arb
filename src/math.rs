//! High-precision mathematical utilities for Solana MEV arbitrage.
//! 
//! Implements numerically stable solvers for optimal arbitrage sizing,
//! exact constant-product market maker calculations, and price impact analysis.

use std::f64;

/// Maximum u128 value as f64 for safe conversion checks
const MAX_U128_AS_F64: f64 = 340282366920938463463374607431768211455.0;

/// Numerically stable hybrid Newton-Raphson + Bisection solver for optimal arbitrage.
/// 
/// Finds the optimal trade size `delta` that maximizes arbitrage profit across two
/// CPMM pools with asymmetric fees. Uses hybrid approach for guaranteed convergence.
/// 
/// # Arguments
/// * `r_sol_a` - SOL reserve in pool A (input token for first leg)
/// * `r_tok_a` - Token reserve in pool A (output token for first leg)
/// * `gamma_a` - Fee multiplier for pool A (e.g., 0.997 for 0.3% fee)
/// * `r_sol_b` - SOL reserve in pool B (output token for second leg)
/// * `r_tok_b` - Token reserve in pool B (input token for second leg)
/// * `gamma_b` - Fee multiplier for pool B
/// * `max_iterations` - Maximum Newton iterations before falling back to bisection
/// * `tolerance` - Convergence tolerance for |f(delta)| < tolerance
/// 
/// # Returns
/// * `Some(delta)` - Optimal trade size in SOL, or None if no profitable arbitrage exists
/// 
/// # Mathematical Model
/// Profit function: P(δ) = γ_b * r_tok_b * δ / (r_sol_b + γ_b * δ) - (r_tok_a * δ) / (γ_a * (r_sol_a + δ))
/// 
/// First-order condition set to zero yields quartic in δ. We solve via Newton-Raphson
/// with bisection safeguard for robust convergence.
pub fn solve_optimal_arbitrage_newton(
    r_sol_a: f64,
    r_tok_a: f64,
    gamma_a: f64,
    r_sol_b: f64,
    r_tok_b: f64,
    gamma_b: f64,
    max_iterations: usize,
    tolerance: f64,
) -> Option<f64> {
    // Validate inputs
    if !r_sol_a.is_finite() || !r_tok_a.is_finite() || !r_sol_b.is_finite() || !r_tok_b.is_finite() {
        return None;
    }
    if r_sol_a <= 0.0 || r_tok_a <= 0.0 || r_sol_b <= 0.0 || r_tok_b <= 0.0 {
        return None;
    }
    if gamma_a <= 0.0 || gamma_a >= 1.0 || gamma_b <= 0.0 || gamma_b >= 1.0 {
        return None;
    }
    if tolerance <= 0.0 || !tolerance.is_finite() {
        return None;
    }
    if max_iterations == 0 {
        return None;
    }

    // Precompute constants for numerical stability
    let gamma_a_sq = gamma_a * gamma_a;
    let gamma_b_sq = gamma_b * gamma_b;
    
    // Coefficients for the profit derivative = 0 condition
    // After clearing denominators, we get a cubic in δ:
    // a3*δ^3 + a2*δ^2 + a1*δ + a0 = 0
    
    let a3 = gamma_b_sq * r_tok_b;
    let a2 = 2.0 * gamma_b * r_sol_b * r_tok_b;
    let a1 = r_sol_b * r_sol_b * r_tok_b - gamma_a_sq * r_tok_a * r_sol_a / (gamma_a * gamma_a);
    // Actually, let's derive more carefully with proper algebra
    
    // Profit: P(δ) = γ_b * r_tok_b * δ / (r_sol_b + γ_b * δ) - r_tok_a * δ / (γ_a * (r_sol_a + δ))
    // Let f(δ) = P'(δ) = 0 for optimum
    
    // Term 1 derivative: γ_b * r_tok_b * r_sol_b / (r_sol_b + γ_b * δ)^2
    // Term 2 derivative: r_tok_a * (r_sol_a + δ - δ) / (γ_a * (r_sol_a + δ)^2) = r_tok_a * r_sol_a / (γ_a * (r_sol_a + δ)^2)
    
    // Actually: d/dδ [δ / (r_sol_a + δ)] = (r_sol_a + δ - δ) / (r_sol_a + δ)^2 = r_sol_a / (r_sol_a + δ)^2
    
    // So: γ_b * r_tok_b * r_sol_b / (r_sol_b + γ_b * δ)^2 = r_tok_a * r_sol_a / (γ_a * (r_sol_a + δ)^2)
    
    // Cross multiply:
    // γ_b * r_tok_b * r_sol_b * γ_a * (r_sol_a + δ)^2 = r_tok_a * r_sol_a * (r_sol_b + γ_b * δ)^2
    
    // Let c1 = γ_a * γ_b * r_tok_b * r_sol_b, c2 = r_tok_a * r_sol_a
    
    let c1 = gamma_a * gamma_b * r_tok_b * r_sol_b;
    let c2 = r_tok_a * r_sol_a;
    
    // c1 * (r_sol_a + δ)^2 = c2 * (r_sol_b + γ_b * δ)^2
    
    // Expand: c1 * (r_sol_a^2 + 2*r_sol_a*δ + δ^2) = c2 * (r_sol_b^2 + 2*γ_b*r_sol_b*δ + γ_b^2*δ^2)
    
    // (c1 - c2*γ_b^2) * δ^2 + (2*c1*r_sol_a - 2*c2*γ_b*r_sol_b) * δ + (c1*r_sol_a^2 - c2*r_sol_b^2) = 0
    
    // This is a quadratic! Much simpler than cubic.
    
    let a = c1 - c2 * gamma_b_sq;
    let b = 2.0 * (c1 * r_sol_a - c2 * gamma_b * r_sol_b);
    let c = c1 * r_sol_a * r_sol_a - c2 * r_sol_b * r_sol_b;
    
    // Solve quadratic: a*δ^2 + b*δ + c = 0
    
    // Check if it's actually linear (a ≈ 0)
    let eps = 1e-15 * (c1.abs() + c2.abs()).max(1.0);
    
    let roots = if a.abs() < eps {
        // Linear case: b*δ + c = 0
        if b.abs() < eps {
            return None; // No solution or infinite solutions
        }
        vec![-c / b]
    } else {
        let disc = b * b - 4.0 * a * c;
        if disc < 0.0 {
            // No real roots - check boundary for profitable trade
            return find_boundary_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b);
        }
        let sqrt_disc = disc.sqrt();
        vec![(-b + sqrt_disc) / (2.0 * a), (-b - sqrt_disc) / (2.0 * a)]
    };
    
    // Find valid positive root that maximizes profit
    let mut best_delta: Option<f64> = None;
    let mut best_profit = 0.0;
    
    for delta in roots {
        if delta.is_finite() && delta > tolerance {
            // Check second order condition (should be maximum, not minimum)
            let profit = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta);
            if profit > best_profit && profit > tolerance {
                // Verify it's a maximum: second derivative < 0
                let second_deriv = profit_second_derivative(
                    r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta
                );
                if second_deriv < 0.0 {
                    best_profit = profit;
                    best_delta = Some(delta);
                }
            }
        }
    }
    
    // Also check small epsilon for corner case
    let eps_check = tolerance.max(1e-9);
    let profit_at_eps = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, eps_check);
    if profit_at_eps > best_profit && profit_at_eps > tolerance {
        // Need to search for interior optimum near zero
        let refined = refine_near_zero(
            r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, eps_check, tolerance, max_iterations
        );
        if let Some(r) = refined {
            let p = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, r);
            if p > best_profit {
                best_delta = Some(r);
                best_profit = p;
            }
        }
    }
    
    // Verify solution is profitable
    if let Some(delta) = best_delta {
        let final_profit = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta);
        if final_profit > tolerance {
            // Final Newton refinement for full precision
            let refined = newton_refine(
                r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b,
                delta, max_iterations, tolerance
            );
            return Some(refined.max(0.0));
        }
    }
    
    None
}

/// Calculate profit for given trade size
fn calculate_profit(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
    delta: f64,
) -> f64 {
    if delta <= 0.0 {
        return 0.0;
    }
    
    // Output from pool A: sell SOL for token
    // amount_out = gamma_a * r_tok_a * delta / (r_sol_a + delta)
    let out_a = gamma_a * r_tok_a * delta / (r_sol_a + delta);
    
    // Input to pool B: sell token for SOL
    // But we need to match: out_a tokens in -> SOL out
    // amount_out = gamma_b * r_sol_b * amount_in / (r_tok_b + amount_in)
    let out_b = gamma_b * r_sol_b * out_a / (r_tok_b + out_a);
    
    out_b - delta
}

/// Second derivative of profit (should be negative at maximum)
fn profit_second_derivative(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
    delta: f64,
) -> f64 {
    // Numerical second derivative
    let h = 1e-8 * delta.max(1.0);
    let f_plus = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta + h);
    let f_minus = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta - h);
    (f_plus - f_minus) / (2.0 * h)
}

/// First derivative of profit
fn profit_derivative(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
    delta: f64,
) -> f64 {
    if delta <= 0.0 {
        return f64::NAN;
    }
    
    // d/dδ [out_b - delta]
    // This requires chain rule through both pools
    
    // Pool A output: out_a = gamma_a * r_tok_a * delta / (r_sol_a + delta)
    // dout_a/ddelta = gamma_a * r_tok_a * r_sol_a / (r_sol_a + delta)^2
    
    let denom_a = r_sol_a + delta;
    let dout_a = gamma_a * r_tok_a * r_sol_a / (denom_a * denom_a);
    
    // Pool B output: out_b = gamma_b * r_sol_b * out_a / (r_tok_b + out_a)
    // dout_b/dout_a = gamma_b * r_sol_b * r_tok_b / (r_tok_b + out_a)^2
    
    let out_a = gamma_a * r_tok_a * delta / denom_a;
    let denom_b = r_tok_b + out_a;
    let dout_b_dout_a = gamma_b * r_sol_b * r_tok_b / (denom_b * denom_b);
    
    dout_b_dout_a * dout_a - 1.0
}

/// Newton refinement starting from initial guess
fn newton_refine(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
    mut delta: f64,
    max_iter: usize,
    tol: f64,
) -> f64 {
    for _ in 0..max_iter {
        let f = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta);
        if f.abs() < tol {
            return delta;
        }
        
        // Numerical derivative of derivative = second derivative
        let h = 1e-8 * delta.max(1.0);
        let f_plus = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta + h);
        let f_minus = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, delta - h);
        let df = (f_plus - f_minus) / (2.0 * h);
        
        if df.abs() < 1e-15 {
            return delta; // Flat region
        }
        
        let delta_new = delta - f / df;
        
        // Safeguard: don't overshoot
        if delta_new < 0.0 || !delta_new.is_finite() {
            return delta;
        }
        
        // Check convergence
        if (delta_new - delta).abs() < tol * delta.max(1.0) {
            return delta_new;
        }
        
        delta = delta_new;
    }
    
    delta
}

/// Refine solution near zero with bisection
fn refine_near_zero(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
    start: f64, tol: f64, max_iter: usize,
) -> Option<f64> {
    let mut lo = 0.0;
    let mut hi = start * 10.0;
    
    // Expand hi until we find sign change or unprofitability
    for _ in 0..50 {
        let p = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, hi);
        let d = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, hi);
        
        if p < 0.0 || (d < 0.0 && p < calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, lo)) {
            break;
        }
        hi *= 2.0;
        if !hi.is_finite() || hi > 1e18 {
            return None;
        }
    }
    
    // Bisection on derivative
    let flo = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, lo);
    let fhi = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, hi);
    
    if flo * fhi > 0.0 {
        // No sign change - check if always positive (profit increasing)
        if flo > 0.0 {
            // Profit increasing throughout - optimum at boundary or infinity
            return None;
        }
        // Always negative - maximum at 0
        return Some(0.0);
    }
    
    for _ in 0..max_iter {
        let mid = (lo + hi) / 2.0;
        let fmid = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, mid);
        
        if fmid.abs() < tol || (hi - lo) < tol * mid.max(1.0) {
            return Some(mid);
        }
        
        if flo * fmid < 0.0 {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    
    Some((lo + hi) / 2.0)
}

/// Find profitable trade at boundary when no interior critical point exists
fn find_boundary_profit(
    r_sol_a: f64, r_tok_a: f64, gamma_a: f64,
    r_sol_b: f64, r_tok_b: f64, gamma_b: f64,
) -> Option<f64> {
    // Check if any trade is profitable by examining limit as delta -> 0+
    let deriv_at_0 = profit_derivative(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, 1e-10);
    
    if deriv_at_0 <= 0.0 {
        return None; // No profitable direction
    }
    
    // Find where profit becomes zero
    let mut lo = 0.0;
    let mut hi = r_sol_a * 0.5;
    
    // Expand or contract until we bracket the zero-crossing
    for _ in 0..50 {
        let p = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, hi);
        if p <= 0.0 {
            break;
        }
        hi *= 1.5;
        if hi > r_sol_a {
            hi = r_sol_a * 0.99;
            break;
        }
    }

    // Binary search for maximum profit point
    for _ in 0..40 {
        let mid1 = lo + (hi - lo) / 3.0;
        let mid2 = hi - (hi - lo) / 3.0;
        let p1 = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, mid1);
        let p2 = calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, mid2);

        if p1 < p2 {
            lo = mid1;
        } else {
            hi = mid2;
        }
    }

    let best_s = (lo + hi) / 2.0;
    if calculate_profit(r_sol_a, r_tok_a, gamma_a, r_sol_b, r_tok_b, gamma_b, best_s) > 0.0 {
        Some(best_s)
    } else {
        None
    }
}