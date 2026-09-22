from pydantic import BaseModel
from typing import Optional

class CampaignExecuteRequest(BaseModel):
    smtp_profile: str
    mapping_id: Optional[int] = None
    subject: str
    body_template: str
    report_type: str
    sheet_name: str = "Summary"
    start_cell: str = ""
    attach_file: bool = True
    campaign_folder: str

class CampaignRecipeCreate(BaseModel):
    saved_name: str
    config: dict
