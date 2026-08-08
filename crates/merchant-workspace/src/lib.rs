pub fn schema_version() -> u32 {
    merchant_core::SCHEMA_VERSION
}

#[cfg(test)]
mod tests {
    #[test]
    fn shares_the_core_schema_version() {
        assert_eq!(super::schema_version(), 1);
    }
}
