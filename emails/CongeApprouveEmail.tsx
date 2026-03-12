import {
  Html, Head, Body, Container, Heading, Text, Button, Section, Hr,
} from '@react-email/components'
import { formatDateFr, labelTypeConge } from '@/lib/utils/dates'

interface Props {
  prenom: string
  type: string
  date_debut: string
  date_fin: string
  nb_jours: number
  commentaire_admin?: string
  appUrl: string
}

export default function CongeApprouveEmail({
  prenom, type, date_debut, date_fin, nb_jours, commentaire_admin, appUrl,
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
            <div style={{ fontSize: 48 }}>✅</div>
          </div>

          <Heading style={{ color: '#1a2332', fontSize: 20, marginBottom: 8 }}>
            Demande approuvée, {prenom} !
          </Heading>
          <Text style={{ color: '#374151', lineHeight: 1.6 }}>
            Votre demande de <strong>{labelTypeConge(type)}</strong> a été approuvée.
          </Text>

          <Section style={{ background: '#f0fdf4', borderRadius: 8, padding: '16px 20px', margin: '20px 0', border: '1px solid #bbf7d0' }}>
            <Text style={{ margin: 0, color: '#166534', fontSize: 14 }}>
              <strong>Du</strong> {formatDateFr(date_debut)} <strong>au</strong> {formatDateFr(date_fin)}
            </Text>
            <Text style={{ margin: '6px 0 0', color: '#166534', fontSize: 14 }}>
              <strong>{nb_jours} jour{nb_jours > 1 ? 's' : ''} ouvrable{nb_jours > 1 ? 's' : ''}</strong>
            </Text>
          </Section>

          {commentaire_admin && (
            <Section style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', margin: '12px 0' }}>
              <Text style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                <strong>Note de l'administration :</strong> {commentaire_admin}
              </Text>
            </Section>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button href={`${appUrl}/conges`} style={{ background: '#e53e3e', color: '#fff', padding: '13px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Voir mes congés
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
