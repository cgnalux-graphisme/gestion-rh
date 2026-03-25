import {
  Html, Head, Body, Container, Heading, Text, Button, Section, Hr,
} from '@react-email/components'

interface Props {
  prenom: string
  bureauNom: string
  date: string
  raisonPrenom: string
  raisonNom: string
  appUrl: string
}

export default function ReassignationEmail({
  prenom, bureauNom, date, raisonPrenom, raisonNom, appUrl,
}: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f0f2f8' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-block', background: '#e53e3e', color: '#fff', fontWeight: 900, fontSize: 22, borderRadius: 8, padding: '6px 16px', letterSpacing: 1 }}>CG</div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Centrale Générale FGTB Namur-Luxembourg</div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48 }}>🔄</div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20, marginBottom: 8 }}>
            Proposition de réaffectation, {prenom}
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Vous êtes proposé(e) pour une réaffectation temporaire suite à l'absence
            de <strong>{raisonPrenom} {raisonNom}</strong>.
          </Text>

          <Section style={{ background: '#eff6ff', borderRadius: 8, padding: '16px 20px', margin: '20px 0', border: '1px solid #bfdbfe' }}>
            <Text style={{ margin: 0, color: '#1e40af', fontSize: 14 }}>
              <strong>Bureau :</strong> {bureauNom}
            </Text>
            <Text style={{ margin: '6px 0 0', color: '#1e40af', fontSize: 14 }}>
              <strong>Date :</strong> {date}
            </Text>
          </Section>

          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Merci de vous connecter au portail pour accepter ou refuser cette proposition.
          </Text>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={appUrl} style={{ background: '#2563eb', color: '#fff', padding: '13px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Voir la demande
            </Button>
          </div>

          <Hr style={{ margin: '28px 0', borderColor: '#f3f4f6' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
            Portail RH — Centrale Générale FGTB Namur-Luxembourg
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
