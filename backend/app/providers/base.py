from typing import Protocol

class DataProvider(Protocol):
    """Normalized dataset contract shared by demo and official-source ingestion."""
    def load(self) -> dict: ...

class ProviderError(RuntimeError):
    pass
