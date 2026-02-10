import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from "class-validator";


export class AttachmentLinkDto {
  @IsString()
  @IsNotEmpty()
  key: string;
}


export class UnlinkAttachmentDto {
  @IsNotEmpty()
  modelRef: string;


  @IsNotEmpty()
  modelId: number;
}

export class LinkAttachmentDto {
  @IsNotEmpty()
  modelRef: string;


  @IsNotEmpty()
  modelId: number; 
}

export class UploadAttachmentDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;

  @ApiProperty({ 
    description: 'Whether the uploaded file should be publicly accessible',
    required: false,
    default: false,
    type: 'boolean'
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}