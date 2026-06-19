export interface BrazilianState {
  uf: string
  name: string
  latitude: number
  longitude: number
}

/** Capitais dos estados — usadas como referência no mapa. */
export const BRAZILIAN_STATES: BrazilianState[] = [
  { uf: 'AC', name: 'Acre', latitude: -9.97499, longitude: -67.8243 },
  { uf: 'AL', name: 'Alagoas', latitude: -9.66599, longitude: -35.735 },
  { uf: 'AP', name: 'Amapá', latitude: 0.034934, longitude: -51.0694 },
  { uf: 'AM', name: 'Amazonas', latitude: -3.119028, longitude: -60.021731 },
  { uf: 'BA', name: 'Bahia', latitude: -12.9714, longitude: -38.5014 },
  { uf: 'CE', name: 'Ceará', latitude: -3.71722, longitude: -38.5434 },
  { uf: 'DF', name: 'Distrito Federal', latitude: -15.793889, longitude: -47.882778 },
  { uf: 'ES', name: 'Espírito Santo', latitude: -20.3155, longitude: -40.3128 },
  { uf: 'GO', name: 'Goiás', latitude: -16.686891, longitude: -49.264794 },
  { uf: 'MA', name: 'Maranhão', latitude: -2.53874, longitude: -44.2825 },
  { uf: 'MT', name: 'Mato Grosso', latitude: -15.601411, longitude: -56.097892 },
  { uf: 'MS', name: 'Mato Grosso do Sul', latitude: -20.469711, longitude: -54.620121 },
  { uf: 'MG', name: 'Minas Gerais', latitude: -19.916681, longitude: -43.934493 },
  { uf: 'PA', name: 'Pará', latitude: -1.455833, longitude: -48.503887 },
  { uf: 'PB', name: 'Paraíba', latitude: -7.119028, longitude: -34.845012 },
  { uf: 'PR', name: 'Paraná', latitude: -25.4284, longitude: -49.2733 },
  { uf: 'PE', name: 'Pernambuco', latitude: -8.047562, longitude: -34.877 },
  { uf: 'PI', name: 'Piauí', latitude: -5.089212, longitude: -42.801613 },
  { uf: 'RJ', name: 'Rio de Janeiro', latitude: -22.906847, longitude: -43.172897 },
  { uf: 'RN', name: 'Rio Grande do Norte', latitude: -5.794478, longitude: -35.211 },
  { uf: 'RS', name: 'Rio Grande do Sul', latitude: -30.034647, longitude: -51.217658 },
  { uf: 'RO', name: 'Rondônia', latitude: -8.761161, longitude: -63.903892 },
  { uf: 'RR', name: 'Roraima', latitude: 2.823509, longitude: -60.675833 },
  { uf: 'SC', name: 'Santa Catarina', latitude: -27.595378, longitude: -48.54805 },
  { uf: 'SP', name: 'São Paulo', latitude: -23.55052, longitude: -46.633308 },
  { uf: 'SE', name: 'Sergipe', latitude: -10.947247, longitude: -37.073082 },
  { uf: 'TO', name: 'Tocantins', latitude: -10.184, longitude: -48.333 },
]

export function getStateByUf(uf: string): BrazilianState | undefined {
  return BRAZILIAN_STATES.find((state) => state.uf === uf)
}

export function formatLocationPlace(city: string, uf: string): string {
  return `${city} - ${uf}`
}
