import type { Venue } from '@/types/index'

export const VENUES: Record<string, Venue> = {
  gem:     { name: 'GEM Center',             area: 'District 1', main: true },
  dream:   { name: 'Dreamplex',              area: 'District 1' },
  sihub:   { name: 'Saigon Innovation Hub',  area: 'District 3' },
  rmit:    { name: 'RMIT Saigon South',      area: 'District 7' },
  hive:    { name: 'The Hive Thao Dien',     area: 'District 2' },
  tbc:     { name: 'Venue TBC',              area: 'Ho Chi Minh City' },
  tasco:   { name: 'Tasco',                  area: 'Ho Chi Minh City' },
  awsHcmc: { name: 'AWS HCMC Office',        area: 'Ho Chi Minh City' },
  vng:     { name: 'VNG Campus',             area: 'Ho Chi Minh City' },
  bitexco: { name: 'Bitexco Financial Office', area: 'District 1' },
  lynkco:  { name: 'Lynk & Co Center',       area: 'Thạnh Mỹ Tây' },
}
